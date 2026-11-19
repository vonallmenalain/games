/*
 * eisstock.js – Eisstock. Zehn Bahnen, je ein Schub – gemessen wird auf den Zentimeter.
 * ---------------------------------------------------------------------------
 * Eine Eisfläche von oben, an ihrem Ende die Ringe des Ziels. Der Stock wird
 * wie eine Schleuder gespannt: irgendwo aufsetzen, zurückziehen, loslassen.
 * Die Richtung des Zugs ist die Richtung des Schubs, seine Länge die Kraft.
 * Dann gleitet der Stock, bis das Eis ihn anhält – und gemessen wird, wie
 * weit er von der Mitte des Ziels liegt. Bis zu hundert Punkte je Bahn,
 * tausend im Ganzen.
 *
 * Jede Bahn ist anders: geradeaus und schräg; durch Schnee, der bremst, und
 * über blankes Eis, das trägt; über die Bande um einen Balken herum; durch
 * eine Gasse zwischen zwei Stöcken; am Hang, der den Stock zur Seite zieht;
 * über die Bande um zwei Balken; und beim Anstossen zählt nicht der eigene
 * Stock, sondern der goldene, den er trifft.
 *
 * Gerechnet wird in festen Schritten (240 je Sekunde), nur mit dem, was der
 * Schub hergibt: Derselbe Schub endet immer am selben Ort. So lässt sich
 * jede Bahn vorausrechnen (loese – für die Prüfung und das Beispiel der
 * Vorschau) und jede Runde nachspielen.
 *
 * Vor jeder Bahn steht, was zu tun ist, mit einem Beispiel, das sich selbst
 * spielt. Die Uhr läuft erst nach einem Tipp.
 *
 * Die Bahnen kommen aus zufall.js – ohne Turnier jedes Mal andere, im
 * Turnier für alle dieselben. Aufgezeichnet werden die Züge (geist.js,
 * zuege): jede Bahn, das Zielen und der Schub. Damit lassen sich die besten
 * Runden anschauen, und im Multiplayer sehen die anderen dasselbe.
 *
 * Gerechnet wird in Metern: x quer über die Bahn (0 … 6), y die Bahn
 * hinauf (0 … 9). Hochkant liegt das Ziel oben, quer liegt es rechts.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "icestock") return;

  const host = document.querySelector("#es-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: welche zehn Bahnen kommen und wie sie aussehen. Die
  // Beispiele der Vorschau, der Eisstaub und das Korn des Eises nehmen
  // Math.random.
  const zufall = window.LernappZufall?.fuer?.("iceStock") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Die Eisfläche (Meter) und der Stock.
  const BREIT = 6;
  const LANG = 9;
  const RADIUS = 0.3;
  // Wo der Stock steht, bevor er geschoben wird.
  const START_Y = 1.15;

  // Wie stark das Eis bremst (m/s²) – überall gleich: ein Eis, an das man
  // sich gewöhnen kann.
  const BREMSE = 1.25;
  // So weit käme der Stock mit voller Kraft (Meter) – gut zweimal die Bahn,
  // genug für zwei Banden und eine Kurve. Die Kraft (0 … 1) ist sein Tempo:
  // halbe Kraft ist ein Viertel des Wegs.
  const WEIT = 21;
  const TEMPO = Math.sqrt(2 * BREMSE * WEIT);
  // Unter so viel Kraft ist ein Zug kein Schub: Er wird zurückgenommen.
  const KRAFT_MIN = 0.06;
  // Was vom Tempo bleibt: an der Bande, am Balken, zwischen zwei Stöcken.
  const PRALL_BANDE = 0.8;
  const PRALL_STOCK = 0.92;
  // Eine gebogene Bande ist so dick (Meter). Sie federt kaum: Wer sie schräg
  // trifft, schmiegt sich an und gleitet an ihr entlang.
  const KURVE_DICK = 0.2;
  const PRALL_KURVE = 0.25;
  const BALKEN_DICK = 0.28;
  // Die festen Schritte der Rechnung, und wie lange sie höchstens läuft.
  const TAKT = 1 / 240;
  const SCHRITTE_MAX = 240 * 14;

  // Wie viele Punkte es für welchen Abstand gibt (Meter → Punkte), dazwischen
  // geradlinig. Hundert gibt es nur bis drei Zentimeter.
  const KNOTEN = [[0.03, 100], [0.1, 92], [0.2, 80], [0.4, 62], [0.7, 42], [1.1, 24], [1.6, 10], [2.3, 0]];
  const PUNKTE_JE_BAHN = 100;
  // Ab so vielen Punkten liegt ein Stock «auf der Daube».
  const GENAU = 92;
  // Die Ringe des Ziels: ihre Halbmesser (Meter).
  const RINGE = [0.2, 0.4, 0.7, 1.1];

  // Die Bahnen nach Schwere. Jede Runde hat jede Art einmal: die beiden
  // leichten, die vier mittleren, die vier schweren.
  const LEICHT = ["gerade", "schraeg"];
  const MITTEL = ["bande", "gasse", "stoss", "kurve"];
  const SCHWER = ["doppelbande", "rueckweg", "wende", "bandenstoss"];
  const PLAN = [2, 4, 4];
  const BAHNEN = PLAN[0] + PLAN[1] + PLAN[2];
  const STUFE = ["leicht", "mittel", "schwer"];

  // So lange hat eine Bahn (Sekunden), bis der Stock unterwegs sein muss.
  const ZEITEN = [12, 15, 20];
  // So lange legt sich eine neue Bahn hin; erst danach läuft die Zeit.
  const EINZUG = 0.45;
  // Ab wann eine Bahn einen Zug annimmt – nicht den Tipp, der sie hinlegte.
  const SPERRE = 0.3;
  // So lange steht das Ergebnis da (Millisekunden).
  const ZEIGEN_MS = 2400;
  // Die Vorschau: wie in den Geschwistern.
  const VORSCHAU = 30;
  const VOR_ZAEHLT = 5;
  const VOR_SPERRE = 0.35;

  // Ein Zug wird auf Zehntausendstel gerundet – so wird er aufgezeichnet,
  // und so wird mit ihm gerechnet.
  const ZUG_TEIL = 10000;

  const TOP_COUNT = 5;

  // ---------------------------------------------------------------------------
  // Rechnen
  // ---------------------------------------------------------------------------
  const clamp = (wert, min, max) => Math.max(min, Math.min(max, wert));
  const lerp = (a, b, k) => a + (b - a) * k;
  const weich = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const TAU = Math.PI * 2;
  const GRAD = Math.PI / 180;
  const zw = (r, a, b) => a + (b - a) * r();
  const mal1 = (r) => (r() < 0.5 ? -1 : 1);

  // ---------------------------------------------------------------------------
  // Die Welt: Stöcke auf dem Eis
  // ---------------------------------------------------------------------------
  /*
   * Eine Bahn:
   *   art, stufe, kurz, frage, zeit
   *   start     wo der eigene Stock steht { x, y }
   *   ziel      die Mitte der Ringe { x, y }
   *   stoecke   was sonst auf dem Eis steht: { x, y, gold } – ein goldener
   *             ist der, der zählt (stoss)
   *   balken    Holzbalken, an denen alles abprallt: { x0, y0, x1, y1 }
   *   kurven    gebogene Banden, Kreisbögen: { x, y, r, von, bis } – die
   *             Mitte, der Halbmesser und von wo bis wo der Bogen geht
   *             (Winkel gegen den Uhrzeigersinn, 0 nach rechts, von < bis)
   *   tipp      bei Bahnen, die von der Lösung her gebaut sind: der Schub,
   *             der mitten ins Ziel führt { winkel, kraft }
   *
   * Die Welt einer Bahn (weltFuer) sind ihre Stöcke mit Ort und Tempo; der
   * erste ist der eigene.
   */
  function weltFuer(bahn) {
    return {
      bahn,
      stoecke: [{ x: bahn.start.x, y: bahn.start.y, vx: 0, vy: 0, eigen: true, gold: false, dreh: 0 }, ...bahn.stoecke.map((s) => ({ x: s.x, y: s.y, vx: 0, vy: 0, eigen: false, gold: Boolean(s.gold), dreh: 0 }))],
      schritte: 0,
      ruht: true,
      // Was im letzten Schritt geschah – fürs Bild und den Klang.
      stoesse: [],
    };
  }

  // Der Punkt einer gebogenen Bande, der (x, y) am nächsten liegt.
  function aufKurve(k, x, y) {
    const w = Math.atan2(y - k.y, x - k.x);
    const d = (((w - k.von) % TAU) + TAU) % TAU;
    if (d <= k.bis - k.von) return [k.x + Math.cos(w) * k.r, k.y + Math.sin(w) * k.r];
    const ax = k.x + Math.cos(k.von) * k.r, ay = k.y + Math.sin(k.von) * k.r;
    const bx = k.x + Math.cos(k.bis) * k.r, by = k.y + Math.sin(k.bis) * k.r;
    return Math.hypot(x - ax, y - ay) <= Math.hypot(x - bx, y - by) ? [ax, ay] : [bx, by];
  }

  // Der Schub: Der eigene Stock bekommt sein Tempo. winkel: von der Bahn
  // weg nach rechts (0: geradeaus), kraft: 0 … 1.
  function schiebe(welt, winkel, kraft) {
    const s = welt.stoecke[0];
    const v = TEMPO * clamp(kraft, 0, 1);
    s.vx = Math.sin(winkel) * v;
    s.vy = Math.cos(winkel) * v;
    welt.ruht = false;
  }

  // Ein Stock prallt von (nx, ny) ab – dem nächsten Punkt eines Balkens oder
  // einer Kurve –, wenn er ihm näher ist als grenze. art: was es war.
  function prall(welt, s, i, nx, ny, grenze, art, prall = PRALL_BANDE) {
    const dx = s.x - nx;
    const dy = s.y - ny;
    const d = Math.hypot(dx, dy);
    if (d >= grenze || d === 0) return;
    const ux = dx / d;
    const uy = dy / d;
    s.x = nx + ux * grenze;
    s.y = ny + uy * grenze;
    const hin = s.vx * ux + s.vy * uy;
    if (hin < 0) {
      s.vx -= (1 + prall) * hin * ux;
      s.vy -= (1 + prall) * hin * uy;
      welt.stoesse.push({ art, wer: i, x: nx, y: ny, wucht: -hin });
    }
  }

  // Ein Schritt der Welt: gleiten, bremsen, abprallen. In welt.stoesse steht,
  // was dabei geschah: { art: "bande" | "balken" | "kurve" | "stock", wer
  // (welcher Stock), x, y, wucht }.
  function schritt(welt) {
    const bahn = welt.bahn;
    welt.stoesse.length = 0;
    let bewegt = false;
    const ab = BREMSE * TAKT;
    welt.stoecke.forEach((s, i) => {
      const v = Math.hypot(s.vx, s.vy);
      if (v <= 0) return;
      // Das Eis bremst gegen die Fahrt.
      if (v <= ab) { s.vx = 0; s.vy = 0; return; }
      const k = (v - ab) / v;
      s.vx *= k;
      s.vy *= k;
      s.x += s.vx * TAKT;
      s.y += s.vy * TAKT;
      s.dreh += v * TAKT * 0.9;
      bewegt = true;
      // Die Banden rundum.
      if (s.x < RADIUS && s.vx < 0) { s.x = RADIUS; s.vx = -s.vx * PRALL_BANDE; welt.stoesse.push({ art: "bande", wer: i, x: 0, y: s.y, wucht: Math.abs(s.vx) }); }
      if (s.x > BREIT - RADIUS && s.vx > 0) { s.x = BREIT - RADIUS; s.vx = -s.vx * PRALL_BANDE; welt.stoesse.push({ art: "bande", wer: i, x: BREIT, y: s.y, wucht: Math.abs(s.vx) }); }
      if (s.y < RADIUS && s.vy < 0) { s.y = RADIUS; s.vy = -s.vy * PRALL_BANDE; welt.stoesse.push({ art: "bande", wer: i, x: s.x, y: 0, wucht: Math.abs(s.vy) }); }
      if (s.y > LANG - RADIUS && s.vy > 0) { s.y = LANG - RADIUS; s.vy = -s.vy * PRALL_BANDE; welt.stoesse.push({ art: "bande", wer: i, x: s.x, y: LANG, wucht: Math.abs(s.vy) }); }
      // Die Balken: vom nächsten Punkt des Balkens weg.
      for (const b of bahn.balken) prall(welt, s, i, clamp(s.x, b.x0, b.x1), clamp(s.y, b.y0, b.y1), RADIUS, "balken");
      // Die Kurven: Wer schräg auf sie trifft, gleitet an ihnen entlang.
      for (const kv of bahn.kurven) {
        // Weit weg von jedem Bogen: nichts zu rechnen.
        if (Math.abs(Math.hypot(s.x - kv.x, s.y - kv.y) - kv.r) > RADIUS + KURVE_DICK) continue;
        const [nx, ny] = aufKurve(kv, s.x, s.y);
        prall(welt, s, i, nx, ny, RADIUS + KURVE_DICK / 2, "kurve", PRALL_KURVE);
      }
    });
    // Stock an Stock: Sie tauschen, was sie aufeinander zu haben.
    for (let i = 0; i < welt.stoecke.length; i += 1) {
      for (let j = i + 1; j < welt.stoecke.length; j += 1) {
        const a = welt.stoecke[i];
        const b = welt.stoecke[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= 2 * RADIUS || d === 0) continue;
        const ux = dx / d;
        const uy = dy / d;
        const zuviel = (2 * RADIUS - d) / 2;
        a.x -= ux * zuviel; a.y -= uy * zuviel;
        b.x += ux * zuviel; b.y += uy * zuviel;
        const hin = (a.vx - b.vx) * ux + (a.vy - b.vy) * uy;
        if (hin <= 0) continue;
        const stoss = ((1 + PRALL_STOCK) / 2) * hin;
        a.vx -= stoss * ux; a.vy -= stoss * uy;
        b.vx += stoss * ux; b.vy += stoss * uy;
        bewegt = true;
        welt.stoesse.push({ art: "stock", wer: i, mit: j, x: a.x + ux * RADIUS, y: a.y + uy * RADIUS, wucht: hin });
      }
    }
    welt.schritte += 1;
    welt.ruht = !bewegt;
    return bewegt;
  }

  // Welcher Stock zählt: der goldene, wenn es einen gibt – sonst der eigene.
  const zaehlt = (welt) => welt.stoecke.find((s) => s.gold) || welt.stoecke[0];

  // Wie weit der Stock, der zählt, von der Mitte des Ziels liegt (Meter, auf
  // den Millimeter).
  function abstandVon(welt) {
    const s = zaehlt(welt);
    return Math.round(Math.hypot(s.x - welt.bahn.ziel.x, s.y - welt.bahn.ziel.y) * 1000) / 1000;
  }

  function punkteFuer(meter) {
    if (!(meter >= 0)) return 0;
    if (meter <= KNOTEN[0][0]) return PUNKTE_JE_BAHN;
    for (let i = 1; i < KNOTEN.length; i += 1) {
      if (meter <= KNOTEN[i][0]) {
        const [x0, p0] = KNOTEN[i - 1];
        const [x1, p1] = KNOTEN[i];
        return Math.round(lerp(p0, p1, (meter - x0) / (x1 - x0)) - 1e-9);
      }
    }
    return 0;
  }

  // Ein Zug, wie er aufgezeichnet wird: Winkel und Kraft als ganze Zahlen.
  const zugVon = (winkel, kraft) => ({ a: Math.round(winkel * ZUG_TEIL), b: Math.round(clamp(kraft, 0, 1) * ZUG_TEIL) });
  const zugZu = (zug) => ({ winkel: zug.a / ZUG_TEIL, kraft: zug.b / ZUG_TEIL });

  // Eine Bahn zu Ende gerechnet: Wo liegt der Stock, der zählt?
  function simuliere(bahn, winkel, kraft) {
    const welt = weltFuer(bahn);
    schiebe(welt, winkel, kraft);
    while (welt.schritte < SCHRITTE_MAX && schritt(welt)) { /* gleiten */ }
    const meter = abstandVon(welt);
    return { meter, punkte: punkteFuer(meter), schritte: welt.schritte, welt };
  }

  /*
   * Der beste Schub, den es für eine Bahn gibt. Gesucht wird zuerst dort, wo
   * er liegen dürfte – um den Tipp einer Bahn, die von der Lösung her gebaut
   * ist, sonst um die gerade Linie zum Stock, der zählt –, und um den besten
   * herum immer feiner. Nur wenn das nicht mitten ins Ziel führt, kommt das
   * ganze Raster über Winkel und Kraft dran. Die Suche ist eine Folge kleiner
   * Schritte (je einer rechnet eine Bahn zu Ende) – so lässt sie sich über
   * viele Bilder verteilen (das Beispiel der Vorschau) oder in einem Zug
   * abarbeiten (loese). Am Schluss steht in ihr.best { winkel, kraft, meter }
   * – gerundet, wie ein Zug aufgezeichnet wird.
   */
  function* suche(bahn, fein = 4) {
    const such = { best: { meter: Infinity, winkel: 0, kraft: 0.5 }, fertig: false };
    const probiere = (winkel, kraft) => {
      if (kraft < KRAFT_MIN || kraft > 1 || Math.abs(winkel) > 85 * GRAD) return false;
      const zug = zugZu(zugVon(winkel, kraft));
      const e = simuliere(bahn, zug.winkel, zug.kraft);
      if (e.meter < such.best.meter) such.best = { meter: e.meter, winkel: zug.winkel, kraft: zug.kraft };
      return true;
    };
    function* feiner() {
      let dw = 1.5 * GRAD;
      let dk = 0.0125;
      for (let runde = 0; runde < fein + 3; runde += 1) {
        const mitte = { ...such.best };
        for (let i = -2; i <= 2; i += 1) for (let j = -2; j <= 2; j += 1) if ((i || j) && probiere(mitte.winkel + i * dw, mitte.kraft + j * dk)) yield such;
        dw /= 2.2;
        dk /= 2.2;
      }
    }
    if (bahn.tipp) {
      // Ein Tipp aus einem Probeschuss führt genau ins Ziel: fertig.
      probiere(bahn.tipp.winkel, bahn.tipp.kraft);
      if (such.best.meter <= 0.005) { such.fertig = true; yield such; return; }
      for (let i = -3; i <= 3; i += 1) for (let j = -3; j <= 3; j += 1) if (probiere(bahn.tipp.winkel + i * 0.4 * GRAD, bahn.tipp.kraft + j * 0.008)) yield such;
    } else {
      const z = bahn.stoecke.find((s) => s.gold) || bahn.ziel;
      const gerade = Math.atan2(z.x - bahn.start.x, z.y - bahn.start.y);
      for (let w = -24; w <= 24; w += 2) for (let k = 0.3; k <= 1.0001; k += 0.025) if (probiere(gerade + w * GRAD, k)) yield such;
    }
    yield* feiner();
    if (such.best.meter > KNOTEN[0][0]) {
      for (let w = -72; w <= 72; w += 3) for (let k = 0.3; k <= 1.0001; k += 0.025) { probiere(w * GRAD, k); yield such; }
      yield* feiner();
    }
    such.fertig = true;
    yield such;
  }

  function loese(bahn, fein = 4) {
    let such = null;
    for (such of suche(bahn, fein)) { /* bis zum Ende */ }
    return { ...such.best, punkte: punkteFuer(such.best.meter) };
  }

  // ---------------------------------------------------------------------------
  // Die Bahnen
  // ---------------------------------------------------------------------------
  const KURZ = {
    gerade: "Geradeaus", schraeg: "Schräg", bande: "Über die Bande", gasse: "Die Gasse", stoss: "Anstossen",
    kurve: "Die Kurve", doppelbande: "Zwei Banden", rueckweg: "Der Rückweg", wende: "Die Wende",
    bandenstoss: "Über Bande anstossen",
  };

  // Was zu tun ist – ein Satz je Art.
  const TUN = {
    gerade: "Schieb den Stock so, dass er mitten im Ziel liegen bleibt.",
    schraeg: "Das Ziel liegt schräg. Schieb den Stock so, dass er mitten darin liegen bleibt.",
    bande: "Der Balken versperrt den Weg. Spiel über die Bande – der Stock prallt ab wie ein Ball.",
    gasse: "Zwischen den beiden Stöcken ist eine Gasse. Schieb deinen hindurch und mitten ins Ziel.",
    stoss: "Hier zählt der goldene Stock: Stoss ihn so an, dass er mitten im Ziel liegen bleibt.",
    kurve: "Triff die gebogene Bande so, dass der Stock an ihr entlanggleitet – sie lenkt ihn ums Eck ins Ziel.",
    doppelbande: "Zwei Balken versperren den Weg. Spiel über zwei Banden im Zickzack bis mitten ins Ziel.",
    rueckweg: "Das Ziel liegt hinter dem Balken. Spiel durch die Lücke und über zwei Banden zurück ins Ziel.",
    wende: "Das Ziel liegt auf der anderen Seite der Wand. Lass den Stock durch die Kehre gleiten und zurück ins Ziel.",
    bandenstoss: "Der goldene Stock zählt – doch ein Balken deckt ihn. Triff ihn über die Bande, sodass er mitten ins Ziel rutscht.",
  };

  // Wie nah der Punkt (x, y) einem Balken kommt (0: darin).
  const balkenAbstand = (b, x, y) => Math.hypot(x - clamp(x, b.x0, b.x1), y - clamp(y, b.y0, b.y1));
  // Wie nah er einer gebogenen Bande kommt (ihrer Mittellinie).
  const kurvenAbstand = (k, x, y) => { const [nx, ny] = aufKurve(k, x, y); return Math.hypot(x - nx, y - ny); };
  // Wie viel Platz um (x, y) frei ist: bis zur Bande, zum nächsten Balken,
  // zur nächsten Kurve.
  function platzBei(bahn, x, y) {
    let d = Math.min(x, BREIT - x, y, LANG - y);
    for (const b of bahn.balken) d = Math.min(d, balkenAbstand(b, x, y));
    for (const k of bahn.kurven) d = Math.min(d, kurvenAbstand(k, x, y) - KURVE_DICK / 2);
    return d;
  }
  // Ob die gerade Linie von p nach q frei ist – für einen ganzen Stock.
  function freieLinie(bahn, p, q) {
    const n = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 0.05);
    for (let i = 0; i <= n; i += 1) {
      if (platzBei(bahn, lerp(p.x, q.x, i / n), lerp(p.y, q.y, i / n)) < RADIUS) return false;
    }
    return true;
  }

  /*
   * Ein Probeschuss mit voller Aufzeichnung: wo der eigene Stock und der, der
   * zählt, unterwegs waren (je ein Punkt alle paar Schritte) und was ihnen
   * geschah. Daraus werden die schweren Bahnen gebaut: Wo der Stock, der
   * zählt, liegen bleibt, ist das Ziel – und der Schub ist der Tipp, der
   * genau hinführt.
   */
  function probeschuss(bahn, winkel, kraft) {
    const welt = weltFuer(bahn);
    schiebe(welt, winkel, kraft);
    const wer = Math.max(0, welt.stoecke.findIndex((s) => s.gold));
    const weg = [];
    const was = [];
    while (welt.schritte < SCHRITTE_MAX && schritt(welt)) {
      for (const e of welt.stoesse) was.push({ ...e, schritt: welt.schritte });
      if (welt.schritte % 3 === 0) {
        weg.push({ x: welt.stoecke[0].x, y: welt.stoecke[0].y });
        if (wer) weg.push({ x: welt.stoecke[wer].x, y: welt.stoecke[wer].y });
      }
    }
    return { welt, weg, was, stock: welt.stoecke[wer], ruht: welt.ruht };
  }

  // Wie weit (Bogenmass) der Stock an einer gebogenen Bande entlanggeglitten ist.
  function geglitten(bahn, was, wer = 0) {
    let best = 0;
    bahn.kurven.forEach((k) => {
      const w = was.filter((e) => e.art === "kurve" && e.wer === wer && Math.abs(Math.hypot(e.x - k.x, e.y - k.y) - k.r) < 1e-6).map((e) => Math.atan2(e.y - k.y, e.x - k.x));
      if (!w.length) return;
      const ab = w.map((x) => (((x - k.von) % TAU) + TAU) % TAU);
      best = Math.max(best, Math.max(...ab) - Math.min(...ab));
    });
    return best;
  }

  /*
   * Ein Balken quer über die gerade Linie vom Start nach (dorthin, wo der
   * Stock, der zählt, anfangs liegt, oder ins Ziel) – so gelegt, dass er dem
   * Weg des Probeschusses nicht in die Quere kommt. Ohne Platz: null.
   */
  function sperre(r, bahn, schuss, nach, ziel) {
    for (let versuch = 0; versuch < 30; versuch += 1) {
      const t = zw(r, 0.35, 0.7);
      const mx = lerp(bahn.start.x, nach.x, t);
      const my = lerp(bahn.start.y, nach.y, t);
      const halb = zw(r, 0.7, 1.4);
      const b = { x0: clamp(mx - halb, 0, BREIT), x1: clamp(mx + halb, 0, BREIT), y0: my - BALKEN_DICK / 2, y1: my + BALKEN_DICK / 2 };
      if (schuss.weg.some((p) => balkenAbstand(b, p.x, p.y) < RADIUS + 0.12)) continue;
      if (balkenAbstand(b, ziel.x, ziel.y) < 0.9 || balkenAbstand(b, nach.x, nach.y) < RADIUS + 0.25 || balkenAbstand(b, bahn.start.x, bahn.start.y) < 0.8) continue;
      if (bahn.kurven.some((k) => kurvenAbstand(k, clamp(mx, b.x0, b.x1), my) < 0.4)) continue;
      return b;
    }
    return null;
  }

  /*
   * Eine Bahn aus Probeschüssen: Die Geometrie (start, balken, kurven, stoecke)
   * kommt von form(r), der Schub von schuss(r) – { winkel, kraft }. Passt, was
   * der Probeschuss erlebt hat (gut(bahn, probe)), wird, wo der Stock, der
   * zählt, liegen bleibt, zum Ziel. Ist die gerade Linie dorthin frei, legt
   * sperre einen Balken quer darüber. Ohne Erfolg: null.
   */
  function ausProbe(r, form, schuss, gut, sperren = true) {
    for (let versuch = 0; versuch < 60; versuch += 1) {
      const bahn = { stoecke: [], balken: [], kurven: [], ...form(r) };
      for (let mal = 0; mal < 6; mal += 1) {
        const s = schuss(r, bahn);
        const zug = zugZu(zugVon(s.winkel, s.kraft));
        const probe = probeschuss(bahn, zug.winkel, zug.kraft);
        if (!probe.ruht) continue;
        const ziel = { x: probe.stock.x, y: probe.stock.y };
        // Das Ziel: frei, nicht zu nah an der Bande (seine Ringe sollen ganz zu sehen sein).
        if (ziel.y < 2.6 || ziel.y > LANG - 0.9 || ziel.x < 0.9 || ziel.x > BREIT - 0.9 || platzBei(bahn, ziel.x, ziel.y) < 0.6 || !gut(bahn, probe, ziel)) continue;
        // Darf der Stock gerade hin (zum goldenen Stock oder ins Ziel)? Dann
        // ein Balken quer darüber – und noch einmal nachgerechnet.
        const nach = bahn.stoecke.find((s) => s.gold) || ziel;
        const fertig = { ...bahn, ziel, tipp: zug };
        if (freieLinie(bahn, bahn.start, nach)) {
          if (!sperren) continue;
          const b = sperre(r, bahn, probe, nach, ziel);
          if (!b) continue;
          fertig.balken = [...bahn.balken, b];
          const nochmal = probeschuss(fertig, zug.winkel, zug.kraft).stock;
          if (Math.hypot(nochmal.x - ziel.x, nochmal.y - ziel.y) > 0.001) continue;
        }
        return fertig;
      }
    }
    return null;
  }

  // Wie oft dem eigenen Stock (wer 0) etwas geschah: art "bande", "balken", "kurve", "stock".
  const zahlVon = (was, art, wer = 0) => was.filter((e) => e.art === art && e.wer === wer && (art !== "bande" || e.wucht > 0.05)).length;
  // Der Schritt, bei dem dem Stock zum ersten Mal so etwas geschah (oder Infinity).
  const erstesMal = (was, art, wer = 0) => was.find((e) => e.art === art && (e.wer === wer || e.mit === wer))?.schritt ?? Infinity;

  /*
   * Eine Bahn über die Bande, von der Lösung her gebaut: erst der Weg über
   * eine Seitenbande, dann das Ziel an sein Ende – und ein Balken quer über
   * die gerade Linie vom Start zum Ziel, der den Weg über die Bande frei
   * lässt. Der Schub, der so entsteht, steht als tipp dabei: Mit
   * ihm findet die Suche (suche) den schmalen Weg sicher.
   */
  function ueberBande(r) {
    const fern = (p, a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
    };
    // Wie nah ein Balken einer Strecke kommt (an seinen Kanten und entlang der Strecke gemessen).
    const nah = (b, p, q) => {
      let d = Infinity;
      for (let i = 0; i <= 8; i += 1) {
        const x = lerp(b.x0, b.x1, i / 8);
        d = Math.min(d, fern({ x, y: b.y0 }, p, q), fern({ x, y: b.y1 }, p, q));
      }
      for (let i = 0; i <= 10; i += 1) {
        const m = { x: lerp(p.x, q.x, i / 10), y: lerp(p.y, q.y, i / 10) };
        d = Math.min(d, Math.hypot(m.x - clamp(m.x, b.x0, b.x1), m.y - clamp(m.y, b.y0, b.y1)));
      }
      return d;
    };
    for (let versuch = 0; versuch < 80; versuch += 1) {
      const seite = mal1(r);
      const start = { x: 3 - seite * zw(r, -0.5, 1.2), y: START_Y };
      // Wo der Stock die Bande trifft (seine Mitte), und wohin er danach fährt.
      const an = { x: seite > 0 ? BREIT - RADIUS : RADIUS, y: zw(r, 3.4, 5.2) };
      const hin = { x: an.x - start.x, y: an.y - start.y };
      const weg = { x: -hin.x * PRALL_BANDE, y: hin.y };
      const vor = Math.hypot(hin.x, hin.y);
      const lang = Math.hypot(weg.x, weg.y);
      const nach = zw(r, 2.4, 3.6);
      const ziel = { x: an.x + (weg.x / lang) * nach, y: an.y + (weg.y / lang) * nach };
      // So weit müsste der Stock auf blankem Eis kommen: Die Bande nimmt ihm Tempo.
      const noetig = vor + nach / (lang / vor) ** 2;
      if (ziel.x < 1.2 || ziel.x > BREIT - 1.2 || ziel.y > LANG - 1.15 || noetig > WEIT * 0.88) continue;
      // Die Balken: quer über der geraden Linie vom Start zum Ziel.
      const wo = [zw(r, 0.42, 0.6)];
      const balken = wo.map((t) => {
        const mx = lerp(start.x, ziel.x, t);
        const my = lerp(start.y, ziel.y, t);
        const halb = zw(r, 1.2, 1.7);
        return { x0: clamp(mx - halb, 0, BREIT), x1: clamp(mx + halb, 0, BREIT), y0: my - 0.14, y1: my + 0.14 };
      });
      const platz = RADIUS + 0.2;
      if (balken.some((b) => nah(b, start, an) < platz || nah(b, an, ziel) < platz || Math.hypot(ziel.x - clamp(ziel.x, b.x0, b.x1), ziel.y - clamp(ziel.y, b.y0, b.y1)) < 0.95)) continue;
      return { start, ziel, balken, tipp: { winkel: Math.atan2(hin.x, hin.y), kraft: Math.sqrt(noetig / WEIT) } };
    }
    return null;
  }

  // Eine Geometrie, links und rechts vertauscht.
  function spiegel(teil) {
    const sp = { ...teil, start: { ...teil.start, x: BREIT - teil.start.x } };
    if (teil.balken) sp.balken = teil.balken.map((b) => ({ ...b, x0: BREIT - b.x1, x1: BREIT - b.x0 }));
    if (teil.kurven) sp.kurven = teil.kurven.map((k) => ({ ...k, x: BREIT - k.x, von: Math.PI - k.bis, bis: Math.PI - k.von }));
    if (teil.stoecke) sp.stoecke = teil.stoecke.map((st) => ({ ...st, x: BREIT - st.x }));
    return sp;
  }
  // Eine Form für die rechte Seite, nach Zufall auch gespiegelt. Der Schub
  // wird für die rechte Seite gedacht; seite dreht ihn mit.
  const seitlich = (form) => (r) => {
    const seite = mal1(r);
    const teil = form(r);
    return { ...(seite > 0 ? teil : spiegel(teil)), seite };
  };
  const QUER = BALKEN_DICK / 2;

  // Die gebogene Bande oben in einer Ecke: Der Stock fährt hinein, gleitet
  // ums Eck und kommt schräg zurück. Ein Balken sperrt den geraden Weg.
  const KURVE = {
    form: seitlich((r) => {
      const R = zw(r, 1.6, 2.2);
      const cx = BREIT - zw(r, 0.75, 1.3) - R;
      const cy = LANG - zw(r, 0.45, 0.9) - R;
      return { start: { x: clamp(cx + R - zw(r, 0.45, 0.9), 2.2, BREIT - 0.6), y: START_Y }, kurven: [{ x: cx, y: cy, r: R, von: -8 * GRAD, bis: zw(r, 115, 150) * GRAD }] };
    }),
    schuss: (r, b) => ({ winkel: b.seite * zw(r, -6, 8) * GRAD, kraft: zw(r, 0.6, 0.95) }),
    // Eine Bahn mittlerer Schwere: Das Ziel liegt nicht weit hinter der Kurve.
    gut: (b, p, ziel) => {
      const raus = p.was.filter((e) => e.art === "kurve" && e.wer === 0).pop();
      return Boolean(raus) && Math.hypot(ziel.x - raus.x, ziel.y - raus.y) < 2.6 && geglitten(b, p.was) >= 70 * GRAD
        && zahlVon(p.was, "balken") === 0 && zahlVon(p.was, "bande") === 0 && Math.abs(ziel.x - b.start.x) > 1.4;
    },
  };

  // Die Wende: eine Wand mitten durchs Eis, oben eine Kehre. Der Stock fährt
  // auf der einen Seite hinauf, durch die Kehre und auf der anderen hinunter.
  const WENDE = {
    form: seitlich((r) => {
      const R = zw(r, 2.15, 2.55);
      const yc = LANG - 0.4 - R - zw(r, 0, 0.35);
      return {
        start: { x: 3 + R - zw(r, 0.4, 0.75), y: START_Y },
        balken: [{ x0: 3 - QUER, x1: 3 + QUER, y0: 0, y1: yc - zw(r, 0.2, 0.9) }],
        kurven: [{ x: 3, y: yc, r: R, von: -6 * GRAD, bis: 186 * GRAD }],
      };
    }),
    schuss: (r, b) => ({ winkel: b.seite * zw(r, -5, 5) * GRAD, kraft: zw(r, 0.7, 0.95) }),
    gut: (b, p, ziel) => geglitten(b, p.was) >= 150 * GRAD && zahlVon(p.was, "balken") === 0 && (ziel.x - 3) * (b.start.x - 3) < 0,
  };

  // Zwei Balken im Z: unten einer von links, weiter oben einer von rechts.
  // Der Weg führt im Zickzack über zwei Banden.
  const DOPPELBANDE = {
    form: seitlich((r) => {
      const ya = zw(r, 2.5, 3.2);
      const yb = zw(r, 5, 5.8);
      return {
        start: { x: zw(r, 1, 2.4), y: START_Y },
        balken: [{ x0: 0, x1: zw(r, 3.4, 4.2), y0: ya - QUER, y1: ya + QUER }, { x0: zw(r, 1.8, 2.6), x1: BREIT, y0: yb - QUER, y1: yb + QUER }],
      };
    }),
    schuss: (r, b) => ({ winkel: b.seite * zw(r, 40, 80) * GRAD, kraft: zw(r, 0.6, 0.95) }),
    gut: (b, p, ziel) => zahlVon(p.was, "bande") >= 2 && zahlVon(p.was, "balken") === 0 && ziel.y > b.balken[1].y1 + 0.7,
  };

  // Ein langer Balken mit einer Lücke an der Seite; das Ziel liegt dahinter.
  // Der Weg führt durch die Lücke und über zwei Banden zurück.
  const RUECKWEG = {
    form: seitlich((r) => {
      const yb = zw(r, 3.8, 4.8);
      return { start: { x: zw(r, 1.2, 4.2), y: START_Y }, balken: [{ x0: 0, x1: BREIT - zw(r, 1.15, 1.5), y0: yb - QUER, y1: yb + QUER }] };
    }),
    schuss: (r, b) => ({ winkel: b.seite * zw(r, 5, 45) * GRAD, kraft: zw(r, 0.6, 0.95) }),
    gut: (b, p, ziel) => {
      const k = b.balken[0];
      const hinter = b.seite > 0 ? ziel.x < k.x1 - 0.6 : ziel.x > k.x0 + 0.6;
      return zahlVon(p.was, "bande") >= 2 && zahlVon(p.was, "balken") === 0 && ziel.y > k.y1 + 0.7 && hinter;
    },
  };

  // Der goldene Stock hinter einem Balken: Der eigene trifft ihn über die
  // Bande, und er rutscht ins Ziel. Den Balken legt sperre.
  const BANDENSTOSS = {
    form: seitlich((r) => ({ start: { x: zw(r, 1.4, 4.6), y: START_Y }, stoecke: [{ x: zw(r, 1.4, 4.6), y: zw(r, 4.6, 6.8), gold: true }] })),
    // Gezielt über eine Seitenbande auf den goldenen Stock: Wo der Stock die
    // Bande treffen muss, folgt aus dem Abprall (quer bleibt PRALL_BANDE).
    schuss: (r, b) => {
      const { x: gx, y: gy } = b.stoecke[0];
      const { x: sx, y: sy } = b.start;
      const w = mal1(r) > 0 ? BREIT - RADIUS : RADIUS;
      const yw = ((gx - w) * sy - PRALL_BANDE * (w - sx) * gy) / ((gx - w) - PRALL_BANDE * (w - sx));
      return { winkel: Math.atan2(w - sx, yw - sy) + zw(r, -2.5, 2.5) * GRAD, kraft: zw(r, 0.55, 0.95) };
    },
    gut: (b, p, ziel) => {
      const treffer = erstesMal(p.was, "stock");
      if (!Number.isFinite(treffer)) return false;
      const vorher = p.was.filter((e) => e.schritt < treffer && e.wer === 0);
      const gold = b.stoecke[0];
      return vorher.some((e) => e.art === "bande") && !vorher.some((e) => e.art === "balken") && Math.hypot(ziel.x - gold.x, ziel.y - gold.y) > 0.9;
    },
  };

  const BAU = {
    gerade(r) {
      const x = zw(r, 1.6, 4.4);
      return { start: { x, y: START_Y }, ziel: { x: clamp(x + zw(r, -0.3, 0.3), 1.2, 4.8), y: zw(r, 3.2, 7.9) } };
    },
    schraeg(r) {
      const seite = mal1(r);
      return { start: { x: 3 - seite * zw(r, 0.8, 1.9), y: START_Y }, ziel: { x: 3 + seite * zw(r, 0.9, 2), y: zw(r, 4.4, 7.9) } };
    },
    // Ein Balken quer über der geraden Linie – der Weg führt über die Bande.
    bande: (r) => ueberBande(r) || BAU.schraeg(r),
    gasse(r) {
      const x = zw(r, 1.8, 4.2);
      const ziel = { x: clamp(x + zw(r, -1.1, 1.1), 1.3, 4.7), y: zw(r, 6.4, 7.9) };
      // Die Gasse: zwei Stöcke quer zum Weg, mitten auf der Strecke.
      const t = zw(r, 0.42, 0.6);
      const mx = lerp(x, ziel.x, t);
      const my = lerp(START_Y, ziel.y, t);
      const lang = Math.hypot(ziel.x - x, ziel.y - START_Y);
      const qx = (ziel.y - START_Y) / lang;
      const qy = -(ziel.x - x) / lang;
      const halb = RADIUS + zw(r, 0.34, 0.42);
      // Der gerade Schub geht mitten durch die Gasse: Er ist der Tipp.
      const tipp = { winkel: Math.atan2(ziel.x - x, ziel.y - START_Y), kraft: Math.sqrt(lang / WEIT) };
      return { start: { x, y: START_Y }, ziel, tipp, stoecke: [{ x: mx + qx * halb, y: my + qy * halb }, { x: mx - qx * halb, y: my - qy * halb }] };
    },
    stoss(r) {
      const x = zw(r, 1.9, 4.1);
      const ziel = { x: clamp(x + zw(r, -1, 1), 1.4, 4.6), y: zw(r, 6, 7.8) };
      // Der goldene Stock liegt auf dem Weg, ein gutes Stück vor dem Ziel.
      const t = zw(r, 0.5, 0.68);
      return { start: { x, y: START_Y }, ziel, stoecke: [{ x: lerp(x, ziel.x, t) + zw(r, -0.12, 0.12), y: lerp(START_Y, ziel.y, t), gold: true }] };
    },
    kurve: (r) => ausProbe(r, KURVE.form, KURVE.schuss, KURVE.gut) || BAU.bande(r),
    wende: (r) => ausProbe(r, WENDE.form, WENDE.schuss, WENDE.gut, false) || BAU.bande(r),
    doppelbande: (r) => ausProbe(r, DOPPELBANDE.form, DOPPELBANDE.schuss, DOPPELBANDE.gut, false) || BAU.bande(r),
    rueckweg: (r) => ausProbe(r, RUECKWEG.form, RUECKWEG.schuss, RUECKWEG.gut, false) || BAU.bande(r),
    bandenstoss: (r) => ausProbe(r, BANDENSTOSS.form, BANDENSTOSS.schuss, BANDENSTOSS.gut) || BAU.stoss(r),
  };

  // Eine Bahn dieser Art. Jede ist so gebaut, dass es einen Schub gibt, der
  // mitten ins Ziel führt (die Prüfung rechnet das nach: loese).
  function lege(art, r) {
    const stufe = LEICHT.includes(art) ? 0 : MITTEL.includes(art) ? 1 : 2;
    return { art, stufe, kurz: KURZ[art], frage: TUN[art], zeit: ZEITEN[stufe], stoecke: [], balken: [], kurven: [], ...BAU[art](r) };
  }

  function mische(liste) {
    const kopie = [...liste];
    for (let i = kopie.length - 1; i > 0; i -= 1) {
      const j = Math.floor(zufall.zahl() * (i + 1));
      [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
    }
    return kopie;
  }

  // Die zehn Bahnen einer Runde.
  function bahnenFuer() {
    const r = () => zufall.zahl();
    const arten = [...mische(LEICHT), ...mische(MITTEL), ...mische(SCHWER)];
    return arten.map((art) => lege(art, r));
  }

  // Die Runde als Text – für die Prüfung, dass in einem Turnier alle dieselbe bekommen.
  function weltText(bahnen = state.bahnen) {
    return (bahnen || []).map((b) => `${b.art}:${b.start.x.toFixed(2)}/${b.ziel.x.toFixed(2)}/${b.ziel.y.toFixed(2)}`).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (vor dem ersten Tipp), "vorschau" (was zu tun ist – die
  // Uhr läuft noch nicht), "aufgabe" (zielen), "fahrt" (die Stöcke gleiten),
  // "zeigen" (das Ergebnis steht da), "warten" (beim Zuschauen, bevor der
  // erste Zug da ist), "ende"
  const state = {
    phase: "bereit",
    bahnen: null,          // die zehn Bahnen der Runde
    index: 0,
    punkte: 0,
    liste: [],             // je Bahn { punkte, meter } – null, solange sie offen ist
    t0: 0,                 // wann die Bahn begann (performance.now)
    vorSeit: 0,            // wann ihre Vorschau begann
    tZeig: 0,              // wann das Ergebnis begann
    gewendet: 0,           // wann zuletzt gewechselt wurde
    welt: null,            // die Stöcke dieser Bahn (weltFuer)
    zielen: null,          // solange gezogen wird: { zeiger, x, y (wo aufgesetzt), winkel, kraft }
    schub: null,           // der Schub, sobald er getan ist { winkel, kraft }
    rest: 0,               // Zeit, die noch nicht in Schritte der Welt umgesetzt ist
    spur: [],              // wo der eigene Stock entlangfuhr – fürs Bild
    staub: [],
    wertung: null,         // { meter, punkte }, sobald alles liegt – meter null: kein Schub
    genaue: 0,
    tickBei: 0,
    beispiel: null,        // das Beispiel der Vorschau
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let status = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Wem zugeschaut wird (live-spiel.js oder ein Lauf aus der Hall of Fame).
  let zuschauer = null;
  // Die Aufzeichnung der Züge (geist.js, zuege).
  let aufnahme = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, u: 1, hoch: true, quer: false, eis: null, text: null, reihe: null, zug: 200, guete: 1, fest: false };

  const bahn = () => state.bahnen?.[state.index] || null;
  const seit = (jetzt = performance.now()) => (jetzt - state.t0) / 1000;
  const offen = () => state.phase === "aufgabe" && !zuschauer;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 60) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

  // Der Stock gleitet übers Eis – so laut, wie er schnell ist.
  let gleiten = null;
  function gleitenAn() {
    if (!gleiten) gleiten = klang()?.kulisse?.("eisstock.gleiten", { laut: 0 }) || null;
  }
  function gleitenAus() {
    gleiten?.stop();
    gleiten = null;
  }

  function staubBei(x, y, viel, weiss = true) {
    if (ruhig()) return;
    for (let i = 0; i < viel; i += 1) {
      const w = Math.random() * TAU;
      const v = 0.3 + Math.random() * 1.6;
      state.staub.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, alt: 0, leben: 0.35 + Math.random() * 0.5, gross: 0.02 + Math.random() * 0.04, gold: !weiss });
    }
  }

  // ---------------------------------------------------------------------------
  // Die Züge
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug):
   *   c   Bahn mal acht, plus was geschah:
   *         0  die Vorschau der Bahn steht da
   *         1  die Bahn liegt da, ihre Uhr läuft
   *         2  es wird gezielt (a: Winkel, b: Kraft – nur fürs Bild, eine Lage)
   *         3  der Schub (a: Winkel, b: Kraft, je mal 10 000)
   *         4  die Zeit war um, ohne Schub
   *         5  alles liegt (a: der Abstand in Millimetern)
   *         6  der Zug wurde zurückgenommen
   * Die Bahnen kommen aus derselben Saat. Wer zuschaut, rechnet denselben
   * Schub mit denselben Schritten – und sieht denselben Stock am selben Ort.
   */
  function meldeZug(was, a = 0, b = 0) {
    if (zuschauer) return;
    const zug = { a, b, c: state.index * 8 + was };
    aufnahme?.zug(state.punkte, zug);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, zug);
  }

  function meldeLage(a, b) {
    if (zuschauer) return;
    const zug = { a, b, c: state.index * 8 + 2 };
    aufnahme?.lage(state.punkte, zug);
    window.LernappLiveSpiel?.lage?.(state.punkte, zug);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  // Das Beispiel der Vorschau: eine zweite Bahn derselben Art. Ihr bester
  // Schub wird gesucht, während sie schon dasteht – ein paar Schritte je Bild.
  function beispielFuer(b) {
    const zweite = lege(b.art, Math.random);
    return { bahn: zweite, such: suche(zweite, 2), schub: null, welt: weltFuer(zweite), t0: performance.now(), los: 0, rest: 0, spur: [] };
  }

  function beispielTakt(dt) {
    const b = state.beispiel;
    if (!b || state.phase !== "vorschau") return;
    if (!b.schub) {
      // Suchen, höchstens ein paar Millisekunden je Bild.
      const bis = performance.now() + 4;
      let stand = null;
      while (performance.now() < bis) {
        const n = b.such.next();
        if (n.done) break;
        stand = n.value;
        if (stand.fertig) break;
      }
      if (stand?.fertig) { b.schub = { ...stand.best }; b.t0 = performance.now(); }
      return;
    }
    // Spannen, loslassen, gleiten, liegen bleiben – und von vorn.
    const t = (performance.now() - b.t0) / 1000;
    if (t >= 1.1 && !b.los) { b.los = 1; schiebe(b.welt, b.schub.winkel, b.schub.kraft); }
    if (b.los && !b.welt.ruht) {
      b.rest += dt;
      let n = 0;
      while (b.rest >= TAKT && n < 40) { schritt(b.welt); b.rest -= TAKT; n += 1; if (n % 6 === 0) b.spur.push({ x: b.welt.stoecke[0].x, y: b.welt.stoecke[0].y }); }
      if (b.welt.ruht) b.los = performance.now();
    } else if (b.los > 1 && performance.now() - b.los > 1300 && !ruhig()) {
      b.welt = weltFuer(b.bahn);
      b.t0 = performance.now();
      b.los = 0;
      b.rest = 0;
      b.spur = [];
    }
  }

  // Die nächste Bahn kündigt sich an: erst die Vorschau.
  function bahnAuf(index) {
    clearStep();
    state.index = index;
    state.phase = "vorschau";
    state.vorSeit = performance.now();
    state.t0 = state.vorSeit;
    state.gewendet = state.vorSeit;
    state.welt = weltFuer(bahn());
    state.zielen = null;
    state.schub = null;
    state.rest = 0;
    state.spur = [];
    state.staub = [];
    state.wertung = null;
    state.tickBei = 0;
    const b = bahn();
    state.beispiel = beispielFuer(b);
    if (status) status.textContent = `Bahn ${index + 1} von ${BAHNEN}: ${b.kurz}. ${b.frage} Tippe, wenn du bereit bist.`;
    ton("eisstock.neu");
    meldeZug(0);
  }

  // Der Tipp nach der Vorschau: Jetzt liegt die Bahn da, und ihre Uhr läuft.
  function bahnLos() {
    if (state.phase !== "vorschau") return;
    state.phase = "aufgabe";
    state.t0 = performance.now();
    state.gewendet = state.t0;
    state.beispiel = null;
    if (status) status.textContent = `Bahn ${state.index + 1} von ${BAHNEN}: ${bahn().frage} Zieh zurück und lass los.`;
    ton("eisstock.tick");
    meldeZug(1);
  }

  // Zielen: Der Zug beginnt, wo der Finger aufsetzt.
  function zielBeginn(x, y, zeiger = 0) {
    if (!offen() || state.zielen || seit() < SPERRE) return false;
    state.zielen = { zeiger, x, y, winkel: 0, kraft: 0 };
    return true;
  }

  // Der Finger ist bei (x, y) im Bild: Daraus werden Winkel und Kraft.
  function zielZu(x, y) {
    const z = state.zielen;
    if (!z || state.phase !== "aufgabe") return;
    // Gezogen wird vom Schub weg – wie an einer Schleuder.
    const dx = z.x - x;
    const dy = z.y - y;
    const quer = view.quer ? dy : dx;
    const lang = view.quer ? dx : -dy;
    const zug = zugVon(Math.atan2(quer, lang), Math.hypot(dx, dy) / view.zug);
    const neu = zugZu(zug);
    if (neu.winkel === z.winkel && neu.kraft === z.kraft) return;
    z.winkel = neu.winkel;
    z.kraft = neu.kraft;
    meldeLage(zug.a, zug.b);
  }

  // Loslassen: der Schub – ausser, es war kaum gezogen.
  function zielEnde() {
    const z = state.zielen;
    if (!z) return;
    state.zielen = null;
    if (state.phase !== "aufgabe") return;
    if (z.kraft < KRAFT_MIN) { meldeZug(6); return; }
    schiebeAb(z.winkel, z.kraft);
  }

  function schiebeAb(winkel, kraft) {
    if (state.phase !== "aufgabe") return;
    const zug = zugVon(winkel, kraft);
    const genau = zugZu(zug);
    state.phase = "fahrt";
    state.zielen = null;
    state.schub = genau;
    state.rest = 0;
    schiebe(state.welt, genau.winkel, genau.kraft);
    meldeZug(3, zug.a, zug.b);
    gleitenAn();
    ton("eisstock.los", { laut: 0.5 + genau.kraft * 0.5 });
    const s = state.welt.stoecke[0];
    staubBei(s.x, s.y, 10);
    kids()?.vibrate?.(10);
  }

  // Alles liegt: messen. soll: die Punkte, wie sie gezählt wurden (beim Zuschauen).
  function werte(meter, soll = null) {
    if (state.phase !== "fahrt" && state.phase !== "aufgabe") return;
    clearStep();
    state.phase = "zeigen";
    state.tZeig = performance.now();
    state.zielen = null;
    const punkte = Number.isFinite(soll) && soll >= 0 && soll <= PUNKTE_JE_BAHN ? soll : meter === null ? 0 : punkteFuer(meter);
    state.wertung = { meter, punkte };
    state.liste[state.index] = { meter, punkte };
    state.punkte += punkte;
    if (punkte >= GENAU) state.genaue += 1;
    shell.setCount(state.punkte);
    if (meter === null) meldeZug(4); else meldeZug(5, Math.round(meter * 1000));
    if (punkte >= GENAU) {
      ton("eisstock.genau");
      const s = zaehlt(state.welt);
      staubBei(s.x, s.y, 26, false);
      kids()?.vibrate?.([14, 40, 22]);
    } else if (punkte >= 40) { ton("eisstock.gut", { laut: 0.5 + punkte / 200 }); kids()?.vibrate?.(12); } else ton("eisstock.daneben", { laut: 0.6 });
    if (status) status.textContent = meter === null ? "Zeit um: 0 Punkte." : `${Math.round(meter * 100)} Zentimeter neben der Mitte: ${punkte} Punkte.`;
    if (!zuschauer) stepTimer = window.setTimeout(weiter, ZEIGEN_MS);
  }

  // Das Ergebnis hat lange genug dagestanden: die nächste Bahn – oder das Ende.
  function weiter() {
    if (state.phase !== "zeigen" || zuschauer) return;
    clearStep();
    if (state.index + 1 >= BAHNEN) finish();
    else bahnAuf(state.index + 1);
  }

  // Die Welt rechnet weiter: so viele feste Schritte, wie Zeit vergangen ist.
  function fahrtTakt(dt) {
    if (state.phase !== "fahrt") return;
    const welt = state.welt;
    state.rest += dt;
    let n = 0;
    while (state.rest >= TAKT && n < 60 && !welt.ruht && welt.schritte < SCHRITTE_MAX) {
      schritt(welt);
      state.rest -= TAKT;
      n += 1;
      for (const e of welt.stoesse) {
        if (e.wucht < 0.15) continue;
        if (e.art === "stock") { ton("eisstock.stoss", { laut: clamp(e.wucht / 3.5, 0.2, 1) }, 40); staubBei(e.x, e.y, 8); kids()?.vibrate?.(8); } else { ton("eisstock.bande", { laut: clamp(e.wucht / 3.5, 0.2, 1) }, 40); staubBei(e.x, e.y, 5); }
      }
      if (welt.schritte % 6 === 0) state.spur.push({ x: welt.stoecke[0].x, y: welt.stoecke[0].y });
    }
    if (n >= 60) state.rest = 0;
    if (welt.ruht || welt.schritte >= SCHRITTE_MAX) {
      gleitenAus();
      if (!zuschauer) werte(abstandVon(welt));
    }
  }

  function uhrTakt() {
    if (zuschauer) return;
    if (state.phase === "vorschau") {
      if (performance.now() - state.vorSeit >= VORSCHAU * 1000) bahnLos();
      return;
    }
    if (state.phase !== "aufgabe") return;
    const rest = EINZUG + bahn().zeit - seit();
    const sekunde = Math.ceil(rest);
    if (rest > 0 && sekunde <= 3 && sekunde !== state.tickBei) { state.tickBei = sekunde; ton("eisstock.tick"); }
    // Ist die Zeit um, gilt der Zug, wie er gerade gespannt ist – sonst nichts.
    if (rest <= 0) {
      const z = state.zielen;
      if (z && z.kraft >= KRAFT_MIN) schiebeAb(z.winkel, z.kraft);
      else werte(null);
    }
  }

  function takt(dt) {
    if (zuschauer && state.phase !== "ende") zuschauenTakt();
    else uhrTakt();
    fahrtTakt(dt);
    beispielTakt(dt);
    // Das Gleiten ist so laut, wie der schnellste Stock schnell ist.
    if (gleiten) {
      const v = state.phase === "fahrt" ? Math.max(...state.welt.stoecke.map((s) => Math.hypot(s.vx, s.vy))) : 0;
      gleiten.laut(clamp(v / 4, 0, 1));
      gleiten.setze(clamp(0.2 + v / 6, 0, 1));
    }
    for (let i = state.staub.length - 1; i >= 0; i -= 1) {
      const f = state.staub[i];
      f.alt += dt;
      if (f.alt >= f.leben) { state.staub.splice(i, 1); continue; }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= 1 - 3 * dt;
      f.vy *= 1 - 3 * dt;
    }
  }

  // Flüssig vor scharf: Stockt das Bild über eine gute Sekunde, wird es
  // gröber gemalt statt langsamer – und bleibt so für den Rest des Besuchs.
  let bildZeit = 1 / 60;
  let zaeh = 0;
  function gueteTakt(sekunden) {
    if (view.fest || sekunden > 0.2 || document.hidden) { zaeh = 0; return; }
    bildZeit += (sekunden - bildZeit) * 0.06;
    zaeh = bildZeit > 0.024 ? zaeh + sekunden : 0;
    if (zaeh > 1.2 && view.guete > 0.5) {
      view.guete *= 0.8;
      view.cssW = 0;
      zaeh = 0;
      bildZeit = 1 / 60;
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    gueteTakt((now - last) / 1000);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "es-platz");
    feld = shell.el("div", "es-feld");
    canvas = document.createElement("canvas");
    canvas.className = "es-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    status = shell.el("p", "cm-sr");
    status.setAttribute("aria-live", "polite");
    platz.append(feld, status);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(Math.min(window.devicePixelRatio || 1, Math.sqrt(3.4e6 / (cssW * cssH))), 1, 3) * view.guete;
    const frei = Math.min(cssH * 0.3, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.hoch = cssH > cssW * 1.05;
    const u = clamp(Math.min(cssW, cssH - frei) / 400, 0.72, 1.3);
    view.u = u;
    const hoehe = cssH - frei;
    // Quer liegt die Bahn quer: der Start links, das Ziel rechts – die Frage
    // steht links daneben, die Reihe der Ergebnisse rechts.
    view.quer = !view.hoch && cssW >= hoehe * 1.5;
    if (view.quer) {
      const rand = Math.round(150 * u);
      let h = Math.max(120, hoehe - Math.round(40 * u));
      let w = h * (LANG / BREIT);
      if (w > cssW - 2 * rand) { w = cssW - 2 * rand; h = w * (BREIT / LANG); }
      const x = Math.round((cssW - w) / 2);
      const y = Math.round(frei + (hoehe - h) / 2 - 8 * u);
      view.eis = { x, y, w, h, s: h / BREIT };
      view.text = { x: Math.round(14 * u), y: y + Math.round(2 * u), w: x - Math.round(30 * u) };
      view.reihe = { x: x + w + Math.round(16 * u), y, w: cssW - x - w - Math.round(30 * u), h, quer: false };
    } else {
      const kopf = Math.round(100 * u);
      const fuss = Math.round(70 * u);
      let w = Math.min(cssW - 20, 560);
      let h = w * (LANG / BREIT);
      if (h > hoehe - kopf - fuss - 6) { h = Math.max(160, hoehe - kopf - fuss - 6); w = h * (BREIT / LANG); }
      const rest = Math.max(0, hoehe - kopf - fuss - h);
      const x = Math.round((cssW - w) / 2);
      const y = Math.round(frei + kopf + rest * 0.4);
      view.eis = { x, y, w, h, s: w / BREIT };
      const breit = Math.min(cssW - 20, Math.max(w, 330 * u));
      view.text = { x: Math.round((cssW - breit) / 2) + 2, y: y - kopf + Math.round(4 * u), w: breit - 4 };
      view.reihe = { x: Math.round((cssW - breit) / 2), y: y + h + Math.round(22 * u), w: breit, h: fuss - Math.round(28 * u), quer: true };
    }
    // So weit muss der Finger für die volle Kraft zurück (Bildpunkte).
    view.zug = clamp(Math.max(view.eis.w, view.eis.h) * 0.62, 170, 420);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    eisBild = null;
  }

  // Wo ein Zeiger im Bild ist.
  function bildOrt(event) {
    const r = canvas.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  const SERIF = 'Georgia, "Times New Roman", serif';
  const SANS = "system-ui, sans-serif";
  const HELL = "#f1f7ff";
  const GOLD = "#ffd166";
  const ROT = "#ff6b6b";
  const GRUEN = "#4ade80";
  const STUFEN_FARBE = ["#4ade80", "#fbbf24", "#ff6b6b"];

  function rundes(x, y, w, h, r) {
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
    else g.rect(x, y, w, h);
  }

  /*
   * Eine Bahn im Bild: T sagt, wo sie liegt { x, y, s (Bildpunkte je Meter),
   * quer }. Hochkant liegt das Ziel oben, quer rechts. Im Rahmen von mitT
   * gelten Meter der Bahn – gezeichnet wird, als läge sie hochkant vor einem.
   */
  const ortIn = (T, x, y) => (T.quer ? [T.x + y * T.s, T.y + x * T.s] : [T.x + x * T.s, T.y + (LANG - y) * T.s]);
  function mitT(T, tun) {
    g.save();
    if (T.quer) g.transform(0, T.s, T.s, 0, T.x, T.y);
    else g.transform(T.s, 0, 0, -T.s, T.x, T.y + LANG * T.s);
    tun();
    g.restore();
  }

  // Das Eis: einmal gemalt – die Fläche mit ihren Kratzern, die Banden aus
  // Holz, der Schnee drumherum.
  let eisBild = null;
  const EIS_RAND = 22;
  function eisMalen() {
    if (eisBild) return eisBild;
    const d = view.dpr;
    const e = view.eis;
    const rand = EIS_RAND;
    const c = document.createElement("canvas");
    c.width = Math.round((e.w + rand * 2) * d);
    c.height = Math.round((e.h + rand * 2) * d);
    const z = c.getContext("2d");
    z.scale(d, d);
    z.translate(rand, rand);
    const r = Math.max(6, e.s * 0.16);
    const form = (wie, aus = 0) => { wie.beginPath(); wie.roundRect ? wie.roundRect(-aus, -aus, e.w + 2 * aus, e.h + 2 * aus, r + aus) : wie.rect(-aus, -aus, e.w + 2 * aus, e.h + 2 * aus); };
    // Die Bande: ein Rahmen aus Holz, mit Schatten.
    z.save();
    z.shadowColor = "rgba(0, 0, 0, 0.55)";
    z.shadowBlur = 16;
    z.shadowOffsetY = 5;
    const holz = Math.max(6, e.s * 0.13);
    z.fillStyle = "#6b4a2e";
    form(z, holz);
    z.fill();
    z.restore();
    z.strokeStyle = "rgba(255, 220, 170, 0.25)";
    z.lineWidth = 1.2;
    form(z, holz - 1);
    z.stroke();
    // Das Eis.
    z.save();
    form(z);
    z.clip();
    const verlauf = z.createLinearGradient(0, 0, e.w, e.h);
    verlauf.addColorStop(0, "#d9eefb");
    verlauf.addColorStop(0.5, "#c3e2f6");
    verlauf.addColorStop(1, "#a9d2ee");
    z.fillStyle = verlauf;
    z.fillRect(0, 0, e.w, e.h);
    // Der Glanz: ein heller Schein, schräg über die Fläche.
    const glanz = z.createLinearGradient(0, e.h * 0.1, e.w, e.h * 0.9);
    glanz.addColorStop(0, "rgba(255, 255, 255, 0)");
    glanz.addColorStop(0.42, "rgba(255, 255, 255, 0.34)");
    glanz.addColorStop(0.55, "rgba(255, 255, 255, 0.05)");
    glanz.addColorStop(1, "rgba(255, 255, 255, 0)");
    z.fillStyle = glanz;
    z.fillRect(0, 0, e.w, e.h);
    // Kratzer von Kufen und Stöcken.
    const n = Math.round((e.w * e.h) / 1500);
    z.lineCap = "round";
    for (let i = 0; i < n; i += 1) {
      const x = Math.random() * e.w;
      const y = Math.random() * e.h;
      const lang = 8 + Math.random() * 46;
      const w = Math.random() * Math.PI;
      z.strokeStyle = Math.random() < 0.6 ? "rgba(255, 255, 255, 0.42)" : "rgba(70, 120, 170, 0.14)";
      z.lineWidth = 0.5 + Math.random() * 0.7;
      z.beginPath();
      z.moveTo(x, y);
      z.quadraticCurveTo(x + Math.cos(w) * lang * 0.5 + (Math.random() - 0.5) * 8, y + Math.sin(w) * lang * 0.5 + (Math.random() - 0.5) * 8, x + Math.cos(w) * lang, y + Math.sin(w) * lang);
      z.stroke();
    }
    // Zum Rand hin dunkler: Dort liegt Schatten der Bande.
    const dunkel = z.createRadialGradient(e.w / 2, e.h / 2, Math.min(e.w, e.h) * 0.3, e.w / 2, e.h / 2, Math.max(e.w, e.h) * 0.75);
    dunkel.addColorStop(0, "rgba(20, 60, 110, 0)");
    dunkel.addColorStop(1, "rgba(20, 60, 110, 0.22)");
    z.fillStyle = dunkel;
    z.fillRect(0, 0, e.w, e.h);
    z.restore();
    z.strokeStyle = "rgba(40, 80, 120, 0.5)";
    z.lineWidth = 1.5;
    form(z);
    z.stroke();
    eisBild = c;
    return c;
  }

  // Der Stock von oben: Schatten, der Ring aus Stahl, die farbige Platte, der Stiel.
  function maleStock(s, deckt = 1) {
    const c = s.gold ? ["#ffe08a", "#d99a1c", "#8a5a00"] : s.eigen ? ["#ff8a73", "#e0533d", "#8c2414"] : ["#9fc3e8", "#4f7fb6", "#1f3f69"];
    g.save();
    g.globalAlpha = deckt;
    g.fillStyle = "rgba(10, 30, 60, 0.3)";
    g.beginPath(); g.arc(s.x + 0.035, s.y - 0.045, RADIUS * 1.02, 0, TAU); g.fill();
    // Der Ring aus Stahl.
    const stahl = g.createLinearGradient(s.x - RADIUS, s.y + RADIUS, s.x + RADIUS, s.y - RADIUS);
    stahl.addColorStop(0, "#f4f7fb");
    stahl.addColorStop(0.5, "#aab4c2");
    stahl.addColorStop(1, "#5b6675");
    g.fillStyle = stahl;
    g.beginPath(); g.arc(s.x, s.y, RADIUS, 0, TAU); g.fill();
    // Die Platte.
    const platte = g.createRadialGradient(s.x - RADIUS * 0.3, s.y + RADIUS * 0.3, RADIUS * 0.1, s.x, s.y, RADIUS * 0.82);
    platte.addColorStop(0, c[0]);
    platte.addColorStop(0.7, c[1]);
    platte.addColorStop(1, c[2]);
    g.fillStyle = platte;
    g.beginPath(); g.arc(s.x, s.y, RADIUS * 0.8, 0, TAU); g.fill();
    // Der Stiel, von oben: ein Knauf mit einem Strich, der sich mitdreht.
    g.translate(s.x, s.y);
    g.rotate(-s.dreh);
    g.strokeStyle = "rgba(255, 255, 255, 0.55)";
    g.lineWidth = RADIUS * 0.12;
    g.lineCap = "round";
    g.beginPath(); g.moveTo(-RADIUS * 0.5, 0); g.lineTo(RADIUS * 0.5, 0); g.stroke();
    g.fillStyle = "#2b2f38";
    g.beginPath(); g.arc(0, 0, RADIUS * 0.27, 0, TAU); g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.5)";
    g.beginPath(); g.arc(-RADIUS * 0.07, RADIUS * 0.08, RADIUS * 0.09, 0, TAU); g.fill();
    g.restore();
  }

  // Die Ringe des Ziels, unter dem Eis gemalt.
  function maleZiel(ziel) {
    const farben = ["rgba(32, 98, 168, 0.3)", "rgba(255, 255, 255, 0.5)", "rgba(224, 83, 61, 0.42)", "rgba(255, 255, 255, 0.75)"];
    g.save();
    for (let i = RINGE.length - 1; i >= 0; i -= 1) {
      g.fillStyle = farben[RINGE.length - 1 - i];
      g.beginPath(); g.arc(ziel.x, ziel.y, RINGE[i], 0, TAU); g.fill();
      g.strokeStyle = "rgba(30, 70, 120, 0.35)";
      g.lineWidth = 0.02;
      g.stroke();
    }
    g.fillStyle = "#c22a1a";
    g.beginPath(); g.arc(ziel.x, ziel.y, 0.055, 0, TAU); g.fill();
    g.restore();
  }

  // Was auf der Bahn liegt: Ziel, Balken, gebogene Banden.
  function maleBoden(b) {
    maleZiel(b.ziel);
    for (const k of b.kurven) {
      // Eine gebogene Bande: ein Bogen aus Holz, mit Schatten und Kanten.
      g.save();
      g.lineCap = "round";
      g.strokeStyle = "rgba(10, 30, 60, 0.3)";
      g.lineWidth = KURVE_DICK;
      g.beginPath(); g.arc(k.x + 0.05, k.y - 0.07, k.r, k.von, k.bis); g.stroke();
      g.strokeStyle = "#8f6240";
      g.beginPath(); g.arc(k.x, k.y, k.r, k.von, k.bis); g.stroke();
      g.strokeStyle = "#c08a5a";
      g.lineWidth = KURVE_DICK * 0.45;
      g.beginPath(); g.arc(k.x, k.y, k.r + KURVE_DICK * 0.1, k.von, k.bis); g.stroke();
      g.strokeStyle = "rgba(60, 35, 15, 0.5)";
      g.lineWidth = 0.022;
      g.lineCap = "butt";
      for (const rr of [k.r - KURVE_DICK / 2, k.r + KURVE_DICK / 2]) { g.beginPath(); g.arc(k.x, k.y, rr, k.von, k.bis); g.stroke(); }
      g.restore();
    }
    for (const k of b.balken) {
      g.save();
      g.fillStyle = "rgba(10, 30, 60, 0.3)";
      g.fillRect(k.x0 + 0.05, k.y0 - 0.07, k.x1 - k.x0, k.y1 - k.y0);
      // Das Holz glänzt quer zum Balken – auch bei einer Wand, die längs steht.
      const laengs = k.y1 - k.y0 > k.x1 - k.x0;
      const holz = laengs ? g.createLinearGradient(k.x1, 0, k.x0, 0) : g.createLinearGradient(0, k.y0, 0, k.y1);
      holz.addColorStop(0, "#7a5333");
      holz.addColorStop(0.5, "#a9764a");
      holz.addColorStop(1, "#c08a5a");
      g.fillStyle = holz;
      g.fillRect(k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0);
      g.strokeStyle = "rgba(60, 35, 15, 0.55)";
      g.lineWidth = 0.025;
      g.strokeRect(k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0);
      g.strokeStyle = "rgba(60, 35, 15, 0.25)";
      for (let i = 1; i < 3; i += 1) {
        g.beginPath();
        if (laengs) { g.moveTo(lerp(k.x0, k.x1, i / 3), k.y0 + 0.04); g.lineTo(lerp(k.x0, k.x1, i / 3), k.y1 - 0.04); } else { g.moveTo(k.x0 + 0.04, lerp(k.y0, k.y1, i / 3)); g.lineTo(k.x1 - 0.04, lerp(k.y0, k.y1, i / 3)); }
        g.stroke();
      }
      g.restore();
    }
  }

  // Die Spur des eigenen Stocks: ein feiner Kratzer im Eis.
  function maleSpur(spur, kopf) {
    if (spur.length < 1) return;
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    spur.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    if (kopf) g.lineTo(kopf.x, kopf.y);
    g.strokeStyle = "rgba(255, 255, 255, 0.55)";
    g.lineWidth = RADIUS * 1.5;
    g.globalAlpha = 0.3;
    g.stroke();
    g.globalAlpha = 1;
    g.strokeStyle = "rgba(60, 110, 160, 0.3)";
    g.lineWidth = 0.035;
    g.stroke();
    g.restore();
  }

  // Die Schleuder: hinten das Band bis zum Griff, vorn die Richtung – und um
  // den Stock ein Bogen, der sich mit der Kraft füllt.
  function maleZielen(s, winkel, kraft) {
    const hin = { x: Math.sin(winkel), y: Math.cos(winkel) };
    // Das Band ist kürzer als der Zug des Fingers: So bleibt es auf dem Eis.
    const zurueck = kraft * 0.5;
    const gilt = kraft >= KRAFT_MIN;
    g.save();
    g.lineCap = "round";
    // Das Band.
    const griff = { x: s.x - hin.x * (RADIUS + zurueck), y: s.y - hin.y * (RADIUS + zurueck) };
    for (const seite of [-1, 1]) {
      g.strokeStyle = gilt ? "rgba(224, 83, 61, 0.85)" : "rgba(120, 140, 160, 0.7)";
      g.lineWidth = 0.05 + 0.05 * (1 - kraft);
      g.beginPath();
      g.moveTo(s.x - hin.y * RADIUS * 0.9 * seite, s.y + hin.x * RADIUS * 0.9 * seite);
      g.lineTo(griff.x, griff.y);
      g.stroke();
    }
    g.fillStyle = gilt ? "#e0533d" : "#8794a3";
    g.beginPath(); g.arc(griff.x, griff.y, 0.11, 0, TAU); g.fill();
    g.strokeStyle = "rgba(255, 255, 255, 0.8)";
    g.lineWidth = 0.03;
    g.stroke();
    // Die Richtung: ein kurzes Stück voraus, gestrichelt – den Rest muss man sehen.
    if (gilt) {
      g.strokeStyle = "rgba(20, 60, 110, 0.75)";
      g.lineWidth = 0.05;
      g.setLineDash([0.12, 0.13]);
      g.beginPath();
      g.moveTo(s.x + hin.x * (RADIUS + 0.1), s.y + hin.y * (RADIUS + 0.1));
      g.lineTo(s.x + hin.x * 1.45, s.y + hin.y * 1.45);
      g.stroke();
      g.setLineDash([]);
      const spitze = { x: s.x + hin.x * 1.7, y: s.y + hin.y * 1.7 };
      g.fillStyle = "rgba(20, 60, 110, 0.85)";
      g.beginPath();
      g.moveTo(spitze.x, spitze.y);
      g.lineTo(spitze.x - hin.x * 0.26 - hin.y * 0.13, spitze.y - hin.y * 0.26 + hin.x * 0.13);
      g.lineTo(spitze.x - hin.x * 0.26 + hin.y * 0.13, spitze.y - hin.y * 0.26 - hin.x * 0.13);
      g.closePath();
      g.fill();
    }
    // Die Kraft: ein Bogen um den Stock.
    const bogen = RADIUS + 0.15;
    g.strokeStyle = "rgba(20, 60, 110, 0.22)";
    g.lineWidth = 0.08;
    g.beginPath(); g.arc(s.x, s.y, bogen, 0, TAU); g.stroke();
    g.strokeStyle = kraft > 0.985 ? "#c22a1a" : "#e0533d";
    g.beginPath(); g.arc(s.x, s.y, bogen, Math.PI / 2, Math.PI / 2 - TAU * kraft, true); g.stroke();
    // Zehn Striche: So lässt sich die Kraft ablesen und wiederfinden.
    g.strokeStyle = "rgba(14, 42, 74, 0.6)";
    g.lineWidth = 0.022;
    g.lineCap = "butt";
    for (let i = 0; i < 10; i += 1) {
      const w = Math.PI / 2 - (TAU * i) / 10;
      const aussen = bogen + (i % 5 === 0 ? 0.13 : 0.09);
      g.beginPath();
      g.moveTo(s.x + Math.cos(w) * (bogen + 0.05), s.y + Math.sin(w) * (bogen + 0.05));
      g.lineTo(s.x + Math.cos(w) * aussen, s.y + Math.sin(w) * aussen);
      g.stroke();
    }
    g.restore();
  }

  // Eine ganze Bahn mit ihrer Welt, im Rahmen T.
  function maleBahn(b, welt, T, e = {}) {
    mitT(T, () => {
      maleBoden(b);
      if (e.spur) maleSpur(e.spur, welt.ruht ? null : welt.stoecke[0]);
      if (e.zielen) maleZielen(welt.stoecke[0], e.zielen.winkel, e.zielen.kraft);
      for (const s of welt.stoecke) maleStock(s);
      if (e.staub) {
        for (const f of e.staub) {
          g.globalAlpha = clamp(1 - f.alt / f.leben, 0, 1) * 0.9;
          g.fillStyle = f.gold ? "#ffd166" : "#ffffff";
          g.beginPath(); g.arc(f.x, f.y, f.gross, 0, TAU); g.fill();
        }
        g.globalAlpha = 1;
      }
    });
  }

  function umbrechen(text, breit) {
    const zeilen = [];
    let zeile = "";
    for (const wort of text.split(" ")) {
      const neu = zeile ? `${zeile} ${wort}` : wort;
      if (zeile && g.measureText(neu).width > breit) { zeilen.push(zeile); zeile = wort; } else zeile = neu;
    }
    if (zeile) zeilen.push(zeile);
    return zeilen;
  }

  // Das Massband: von der Mitte des Ziels zum Stock, mit dem Abstand – und
  // dem, was es dafür gibt.
  function maleMessung(tz) {
    const w = state.wertung;
    const e = view.eis;
    const u = view.u;
    if (!w) return;
    const T = { x: e.x, y: e.y, s: e.s, quer: view.quer };
    const b = bahn();
    const federn = ruhig() ? 1 : 1 + 0.5 * Math.exp(-tz * 12) * Math.cos(tz * 18);
    let ort = [e.x + e.w / 2, e.y + e.h / 2];
    let text = "Zeit um";
    if (w.meter !== null) {
      const s = zaehlt(state.welt);
      const p = ortIn(T, b.ziel.x, b.ziel.y);
      const q = ortIn(T, s.x, s.y);
      const k = ruhig() ? 1 : weich(0, 0.45, tz);
      g.save();
      g.strokeStyle = "#ffd166";
      g.lineWidth = 3;
      g.lineCap = "round";
      g.setLineDash([7, 5]);
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(lerp(p[0], q[0], k), lerp(p[1], q[1], k)); g.stroke();
      g.restore();
      ort = [clamp(q[0], e.x + 62 * u, e.x + e.w - 62 * u), clamp(q[1] - e.s * RADIUS - 30 * u, e.y + 26 * u, e.y + e.h - 26 * u)];
      text = w.meter < 1 ? `${Math.round(w.meter * 100)} cm` : `${w.meter.toFixed(2).replace(".", ",")} m`;
    }
    const c = w.punkte >= GENAU ? GOLD : w.punkte >= 40 ? GRUEN : w.punkte > 0 ? "#8fd3ff" : ROT;
    g.save();
    g.translate(ort[0], ort[1]);
    g.scale(federn, federn);
    g.font = `800 ${Math.round(17 * u)}px ${SANS}`;
    const voll = `${text}  ·  ${w.punkte > 0 ? "+" : ""}${w.punkte}`;
    const breit = g.measureText(voll).width + 26 * u;
    const hoch = 34 * u;
    rundes(-breit / 2, -hoch / 2, breit, hoch, hoch / 2);
    g.fillStyle = "rgba(8, 22, 44, 0.9)";
    g.fill();
    g.strokeStyle = c;
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = c;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(voll, 0, 1);
    g.restore();
  }

  // Die Vorschau: über der Bahn, was zu tun ist – und ein Beispiel, das sich
  // selbst spielt.
  function zeichneVorschau(b) {
    const e = view.eis;
    const u = view.u;
    const jetzt = performance.now();
    const t = (jetzt - state.vorSeit) / 1000;
    g.save();
    rundes(e.x, e.y, e.w, e.h, Math.max(6, e.s * 0.16));
    g.fillStyle = "rgba(8, 22, 44, 0.82)";
    g.fill();
    g.restore();
    // Quer: links der Text, rechts das Beispiel. Hochkant: oben und unten.
    const text = view.quer ? { x: e.x + 16 * u, y: e.y + 12 * u, w: e.w * 0.5 - 24 * u } : { x: e.x + 12 * u, y: e.y + 12 * u, w: e.w - 24 * u };
    g.save();
    g.textAlign = "center";
    g.textBaseline = "top";
    const mx = text.x + text.w / 2;
    g.fillStyle = STUFEN_FARBE[b.stufe];
    g.font = `700 ${Math.round(11.5 * u)}px ${SANS}`;
    g.fillText(`BAHN ${state.index + 1} VON ${BAHNEN}  ·  ${STUFE[b.stufe].toUpperCase()}`, mx, text.y);
    g.fillStyle = HELL;
    g.font = `italic 700 ${Math.round(26 * u)}px ${SERIF}`;
    g.fillText(b.kurz, mx, text.y + 17 * u);
    g.font = `500 ${Math.round(13.5 * u)}px ${SANS}`;
    g.fillStyle = "rgba(226, 238, 252, 0.9)";
    const zeilen = umbrechen(b.frage, text.w);
    zeilen.forEach((zeile, i) => g.fillText(zeile, mx, text.y + 52 * u + i * 17.5 * u));
    g.restore();
    // Das Beispiel: eine kleine Bahn.
    const oben = view.quer ? e.y + 14 * u : text.y + 52 * u + zeilen.length * 17.5 * u + 10 * u;
    const kasten = view.quer ? { x: e.x + e.w * 0.5, y: oben, w: e.w * 0.5 - 16 * u, h: e.h - 28 * u } : { x: e.x + 14 * u, y: oben, w: e.w - 28 * u, h: e.y + e.h - oben - 38 * u };
    const bsp = state.beispiel;
    if (bsp && kasten.h > 60) {
      const s = Math.min(kasten.w / BREIT, kasten.h / LANG);
      const T = { x: kasten.x + (kasten.w - BREIT * s) / 2, y: kasten.y + (kasten.h - LANG * s) / 2, s, quer: false };
      g.save();
      rundes(T.x, T.y, BREIT * s, LANG * s, 6);
      g.fillStyle = "#c3e2f6";
      g.fill();
      g.strokeStyle = "#6b4a2e";
      g.lineWidth = 3;
      g.stroke();
      g.clip();
      // Vor dem Schub spannt sich die Schleuder.
      const spann = bsp.schub && !bsp.los ? { winkel: bsp.schub.winkel, kraft: bsp.schub.kraft * weich(0.15, 0.95, (jetzt - bsp.t0) / 1000) } : null;
      maleBahn(bsp.bahn, bsp.welt, T, { spur: bsp.spur, zielen: spann });
      g.restore();
    }
    const rest = VORSCHAU - t;
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.globalAlpha = rest <= VOR_ZAEHLT ? 1 : 0.55 + 0.45 * Math.sin(jetzt / 320) ** 2;
    g.fillStyle = rest <= VOR_ZAEHLT ? GOLD : HELL;
    g.font = `700 ${Math.round(14 * u)}px ${SANS}`;
    const hinweis = rest <= VOR_ZAEHLT ? `Es geht los in ${Math.max(1, Math.ceil(rest))}` : zuschauer ? "gleich geht es los" : "Tippe, wenn du bereit bist";
    if (view.quer) g.fillText(hinweis, text.x + text.w / 2, e.y + e.h - 20 * u);
    else g.fillText(hinweis, e.x + e.w / 2, e.y + e.h - 18 * u);
    g.restore();
  }

  // Vor der ersten Runde: der Titel über dem Eis, und ein Stock, der seine Kreise zieht.
  function zeichneTitel() {
    const e = view.eis;
    const u = view.u;
    const jetzt = performance.now();
    const T = { x: e.x, y: e.y, s: e.s, quer: view.quer };
    const w = ruhig() ? 1 : jetzt / 1700;
    const s = { x: 3 + Math.sin(w) * 1.7, y: 2.3 + Math.sin(w * 2) * 0.75, eigen: true, gold: false, dreh: w * 2 };
    mitT(T, () => { maleZiel({ x: 3, y: 7.1 }); maleStock(s); });
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    const mx = view.quer ? e.x + e.w * 0.42 : e.x + e.w / 2;
    const my = view.quer ? e.y + e.h * 0.4 : e.y + e.h * 0.47;
    g.fillStyle = "#0e2a4a";
    g.font = `italic 700 ${Math.round(44 * u)}px ${SERIF}`;
    g.fillText("Eisstock", mx, my);
    g.font = `600 ${Math.round(14 * u)}px ${SANS}`;
    g.fillText("Zehn Bahnen. Je ein Schub.", mx, my + 36 * u);
    g.globalAlpha = 0.6 + 0.4 * Math.sin(jetzt / 320) ** 2;
    g.font = `700 ${Math.round(14 * u)}px ${SANS}`;
    g.fillText(zuschauer || shell?.live ? "gleich geht es los" : "Tippe, um zu beginnen", e.x + e.w / 2, e.y + e.h - 22 * u);
    g.restore();
  }

  // Über der Bahn (oder links daneben): welche Bahn, was zu tun ist.
  function zeichneKopf() {
    const b = bahn();
    const t = view.text;
    if (!b || !t || state.phase === "bereit" || state.phase === "warten") return;
    const u = view.u;
    g.save();
    g.textAlign = "left";
    g.textBaseline = "top";
    g.font = `700 ${Math.round(11.5 * u)}px ${SANS}`;
    g.fillStyle = STUFEN_FARBE[b.stufe];
    g.fillText(`BAHN ${state.index + 1}/${BAHNEN}  ·  ${STUFE[b.stufe].toUpperCase()}`, t.x, t.y);
    g.fillStyle = HELL;
    // Der Name der Bahn: kleiner, wenn er sonst nicht in die Spalte passt.
    g.font = `italic 700 ${Math.round(22 * u)}px ${SERIF}`;
    const breit = g.measureText(b.kurz).width;
    if (breit > t.w) g.font = `italic 700 ${Math.max(11, Math.floor((22 * u * t.w) / breit))}px ${SERIF}`;
    g.fillText(b.kurz, t.x, t.y + 16 * u);
    if (state.phase !== "vorschau") {
      g.font = `500 ${Math.round(13.5 * u)}px ${SANS}`;
      g.fillStyle = "rgba(226, 238, 252, 0.82)";
      umbrechen(b.frage, t.w).slice(0, view.quer ? 9 : 3).forEach((zeile, i) => g.fillText(zeile, t.x, t.y + 44 * u + i * 17 * u));
    }
    g.restore();
  }

  // Die Uhr: ein Balken unter der Bahn, der abläuft.
  function zeichneUhr() {
    if (state.phase !== "aufgabe") return;
    const b = bahn();
    const e = view.eis;
    const rest = clamp((EINZUG + b.zeit - seit()) / b.zeit, 0, 1);
    const eng = rest * b.zeit <= 3;
    const hoch = Math.max(4, 5 * view.u);
    const y = e.y + e.h + Math.round(10 * view.u);
    g.save();
    rundes(e.x, y, e.w, hoch, hoch / 2);
    g.fillStyle = "rgba(226, 238, 252, 0.14)";
    g.fill();
    rundes(e.x, y, Math.max(hoch, e.w * rest), hoch, hoch / 2);
    g.fillStyle = eng ? ROT : HELL;
    g.globalAlpha = eng ? 0.75 + 0.25 * Math.sin(performance.now() / 90) ** 2 : 0.9;
    g.fill();
    g.restore();
  }

  // Die Reihe: zehn Scheiben, eine je Bahn.
  function zeichneReihe() {
    const r = view.reihe;
    if (!r) return;
    const u = view.u;
    const scheibe = (i, cx, cy, rad) => {
      const e = state.liste[i];
      const dran = i === state.index && state.phase !== "ende" && state.phase !== "bereit" && state.phase !== "warten";
      g.save();
      g.beginPath();
      g.arc(cx, cy, rad, 0, TAU);
      g.fillStyle = !e ? (dran ? "rgba(56, 189, 248, 0.25)" : "rgba(255, 255, 255, 0.06)") : e.punkte >= GENAU ? "rgba(255, 209, 102, 0.28)" : e.punkte >= 40 ? "rgba(74, 222, 128, 0.22)" : e.punkte > 0 ? "rgba(143, 211, 255, 0.2)" : "rgba(255, 107, 107, 0.2)";
      g.fill();
      g.lineWidth = dran ? 2 : 1.2;
      g.strokeStyle = dran ? "#38bdf8" : !e ? "rgba(226, 238, 252, 0.2)" : e.punkte >= GENAU ? GOLD : e.punkte >= 40 ? GRUEN : e.punkte > 0 ? "#8fd3ff" : ROT;
      g.stroke();
      g.font = `${e ? 800 : 600} ${Math.round(clamp(rad * 0.82, 9, 18))}px ${SANS}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = e ? (e.punkte >= GENAU ? GOLD : HELL) : "rgba(226, 238, 252, 0.4)";
      g.fillText(e ? String(e.punkte) : String(i + 1), cx, cy + 1);
      g.restore();
    };
    if (r.quer) {
      const rad = Math.min(r.h / 2, (r.w / BAHNEN - 4 * u) / 2);
      for (let i = 0; i < BAHNEN; i += 1) scheibe(i, r.x + ((i + 0.5) * r.w) / BAHNEN, r.y + r.h / 2, rad);
    } else {
      const rad = Math.min((r.w / 2 - 6 * u) / 2, (r.h / 5 - 6 * u) / 2, 30 * u);
      for (let i = 0; i < BAHNEN; i += 1) scheibe(i, r.x + r.w / 2 + ((i % 2) - 0.5) * (rad * 2 + 8 * u), r.y + ((Math.floor(i / 2) + 0.5) * r.h) / 5, rad);
    }
  }

  function zeichnen() {
    if (!g || !view.cssW || !view.eis) return;
    const d = view.dpr;
    const jetzt = performance.now();
    const e = view.eis;
    g.setTransform(d, 0, 0, d, 0, 0);
    // Die Nacht um die Eisbahn.
    const nacht = g.createLinearGradient(0, 0, 0, view.cssH);
    nacht.addColorStop(0, "#0c1a2e");
    nacht.addColorStop(1, "#081220");
    g.fillStyle = nacht;
    g.fillRect(0, 0, view.cssW, view.cssH);
    const schein = g.createRadialGradient(e.x + e.w / 2, e.y + e.h / 2, Math.min(e.w, e.h) * 0.3, e.x + e.w / 2, e.y + e.h / 2, Math.max(e.w, e.h) * 0.95);
    schein.addColorStop(0, "rgba(140, 200, 255, 0.16)");
    schein.addColorStop(1, "rgba(140, 200, 255, 0)");
    g.fillStyle = schein;
    g.fillRect(0, 0, view.cssW, view.cssH);
    g.drawImage(eisMalen(), e.x - EIS_RAND, e.y - EIS_RAND, e.w + EIS_RAND * 2, e.h + EIS_RAND * 2);

    const T = { x: e.x, y: e.y, s: e.s, quer: view.quer };
    const b = bahn();
    g.save();
    rundes(e.x, e.y, e.w, e.h, Math.max(6, e.s * 0.16));
    g.clip();
    if (state.phase === "bereit" || state.phase === "warten") zeichneTitel();
    // In der Vorschau liegt die Bahn noch nicht da: Geplant wird erst, wenn die Uhr läuft.
    else if (b && state.phase === "vorschau") zeichneVorschau(b);
    else if (b && state.welt) maleBahn(b, state.welt, T, { spur: state.spur, zielen: state.phase === "aufgabe" ? state.zielen : null, staub: state.staub });
    // Eine neue Bahn blendet auf.
    const blende = ruhig() ? 1 : clamp((jetzt - state.gewendet) / (EINZUG * 1000), 0, 1);
    if (blende < 1) { g.fillStyle = `rgba(200, 228, 247, ${0.9 * (1 - weich(0, 1, blende))})`; g.fillRect(e.x, e.y, e.w, e.h); }
    g.restore();
    if (state.phase === "zeigen" || state.phase === "ende") maleMessung((jetzt - state.tZeig) / 1000);
    // Wer noch nicht zieht, sieht, wie es geht: ein Finger, der irgendwo auf
    // dem Eis aufsetzt und zurückzieht – auf der ersten Bahn gleich, später
    // erst nach einer Weile.
    if (state.phase === "aufgabe" && !state.zielen && !zuschauer && seit() > 1.2) {
      const u = view.u;
      g.save();
      if (!ruhig() && (state.index === 0 || seit() > 5)) {
        const lauf = ((jetzt - state.t0) / 1900) % 1;
        const weg = view.zug * 0.55 * weich(0.12, 0.72, lauf);
        const von = [e.x + e.w * 0.5, e.y + e.h * 0.42];
        const finger = view.quer ? [von[0] - weg, von[1]] : [von[0], von[1] + weg];
        g.globalAlpha = 0.55 * weich(0, 0.1, lauf) * (1 - weich(0.82, 1, lauf));
        g.strokeStyle = "#0e2a4a";
        g.fillStyle = "#0e2a4a";
        g.lineWidth = 2;
        g.setLineDash([5, 6]);
        g.beginPath(); g.moveTo(von[0], von[1]); g.lineTo(finger[0], finger[1]); g.stroke();
        g.setLineDash([]);
        g.beginPath(); g.arc(von[0], von[1], 5 * u, 0, TAU); g.stroke();
        g.globalAlpha *= 0.6;
        g.beginPath(); g.arc(finger[0], finger[1], 15 * u, 0, TAU); g.fill();
      }
      g.globalAlpha = 0.55 + 0.35 * Math.sin(jetzt / 300) ** 2;
      g.fillStyle = "#0e2a4a";
      g.font = `700 ${Math.round(13 * u)}px ${SANS}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      const p = ortIn(T, state.welt.stoecke[0].x, state.welt.stoecke[0].y);
      const text = "irgendwo aufsetzen · zurückziehen · loslassen";
      const halb = g.measureText(text).width / 2 + 8;
      if (view.quer) g.fillText(text, clamp(p[0] + 60 * u + halb, e.x + halb, e.x + e.w - halb), clamp(p[1] + 46 * u, e.y + 16 * u, e.y + e.h - 14 * u));
      else g.fillText(text, e.x + e.w / 2, Math.min(p[1] + 40 * u, e.y + e.h - 12 * u));
      g.restore();
    }
    zeichneKopf();
    zeichneUhr();
    zeichneReihe();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Dieselben Bahnen (die Saat hält geist.js oder der Abend), und Zug um Zug,
  // was der andere tat: dasselbe Zielen, derselbe Schub, zur selben Zeit.
  let gesehenBis = -1;
  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetzt = zuschauer.jetzt();
    for (const zug of zuschauer.seit(gesehenBis, jetzt)) {
      const was = ((zug.c % 8) + 8) % 8;
      const index = clamp(Math.floor(zug.c / 8), 0, BAHNEN - 1);
      const her = Math.max(0, jetzt - zug.t);
      const damals = performance.now() - her;
      if (was === 0) {
        bahnAuf(index);
        state.vorSeit = damals;
        state.gewendet = damals;
      } else if (was === 1) {
        if (state.index !== index || state.phase !== "vorschau") bahnAuf(index);
        bahnLos();
        state.t0 = damals;
        state.gewendet = damals;
      } else if (state.index === index) {
        if (was === 2 && state.phase === "aufgabe") state.zielen = { zeiger: -1, x: 0, y: 0, ...zugZu(zug) };
        else if (was === 6) state.zielen = null;
        else if (was === 3 && state.phase === "aufgabe") {
          const schub = zugZu(zug);
          schiebeAb(schub.winkel, schub.kraft);
          // Was seither schon gefahren wäre, wird nachgeholt.
          let n = Math.min(SCHRITTE_MAX, Math.floor(her / 1000 / TAKT));
          while (n > 0 && !state.welt.ruht) { schritt(state.welt); n -= 1; }
        } else if (was === 4 && state.phase === "aufgabe") {
          werte(null, 0);
          state.tZeig = damals;
        } else if (was === 5 && (state.phase === "fahrt" || state.phase === "aufgabe")) {
          // Alles liegt: Was hier noch gleitet, kommt sofort an.
          while (state.phase === "fahrt" && !state.welt.ruht && state.welt.schritte < SCHRITTE_MAX) schritt(state.welt);
          gleitenAus();
          werte(zug.a / 1000, zug.p - state.punkte);
          state.tZeig = damals;
        }
      }
      if (zug.p !== state.punkte && was >= 4 && was <= 5) { state.punkte = zug.p; shell.setCount(zug.p); }
    }
    gesehenBis = jetzt;
    zuschauer.weiter?.();
  }

  function zuschauenStarten() {
    if (!zuschauer?.seit) return;
    startRun();
    state.phase = "warten";
    shell.setPhase("play");
    gesehenBis = -1;
    zuschauer.los?.();
  }

  // ---------------------------------------------------------------------------
  // Ablauf der Runde
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    shell.setPhase("play");
    aufnahme?.los();
    bahnAuf(0);
  }

  function startRun() {
    clearStep();
    stopLoop();
    gleitenAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.bahnen = bahnenFuer();
    state.phase = "bereit";
    state.index = 0;
    state.punkte = 0;
    state.liste = new Array(BAHNEN).fill(null);
    state.welt = null;
    state.zielen = null;
    state.schub = null;
    state.rest = 0;
    state.spur = [];
    state.staub = [];
    state.wertung = null;
    state.genaue = 0;
    state.beispiel = null;
    state.gewendet = performance.now();
    shell.setCount(0);

    shell.clear();
    const prompt = shell.el("p", "cm-prompt es-prompt", "Zieh zurück wie an einer Schleuder – der Stock soll mitten im Ziel liegen bleiben.");
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
    const dauer = Math.min(900, 250 + ziel);
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
    // Im Live-Modus endet die Runde auch mitten in einer Bahn: Es zählt, was
    // bis dahin liegt.
    state.phase = "ende";
    state.zielen = null;
    gleitenAus();
    const punkte = state.punkte;
    const geist = aufnahme?.ende() || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const gemessen = state.liste.filter((e) => e && e.meter !== null);
    const mittel = gemessen.length ? gemessen.reduce((summe, e) => summe + e.meter, 0) / gemessen.length : null;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: [
        rekord ? "Neuer Rekord!" : "",
        mittel === null ? "" : `im Schnitt ${Math.round(mittel * 100)} cm daneben`,
        state.genaue ? `${state.genaue} auf den Punkt` : "",
        !rekord && vorher ? `Bestwert ${vorher}` : "",
      ].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("es-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.icestock", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Eisstock",
    area: "konzentration",
    accent: "#38BDF8",
    accentDark: "#0b74a8",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "iceStock", fassung: "z2", zufall, zuege: true, einheit: "Punkte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) aufnahme = window.LernappGeist?.zuege?.({ fassung: "z2", zufall }) || null;

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // ---------------------------------------------------------------------------
  // Eingabe
  // ---------------------------------------------------------------------------
  // Ein Tipp: beginnen, die Bahn hinlegen, das Ergebnis überspringen.
  function tippe() {
    if (zuschauer) return false;
    const jetzt = performance.now();
    if (state.phase === "bereit") {
      if (!shell.live) losGehts();
    } else if (state.phase === "vorschau") {
      if (jetzt - state.vorSeit >= VOR_SPERRE * 1000) bahnLos();
    } else if (state.phase === "zeigen") {
      if (jetzt - state.tZeig >= 1200) weiter();
    } else return false;
    return true;
  }

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    if (tippe() || zuschauer) return;
    const ort = bildOrt(event);
    if (zielBeginn(ort.x, ort.y, event.pointerId)) {
      try { canvas.setPointerCapture(event.pointerId); } catch { /* geht auch ohne */ }
    }
  });
  window.addEventListener("pointermove", (event) => {
    if (!state.zielen || state.zielen.zeiger !== event.pointerId || !canvas) return;
    const ort = bildOrt(event);
    zielZu(ort.x, ort.y);
  });
  window.addEventListener("pointerup", (event) => {
    if (!state.zielen || state.zielen.zeiger !== event.pointerId || !canvas) return;
    const ort = bildOrt(event);
    zielZu(ort.x, ort.y);
    zielEnde();
  });
  // Bricht das Gerät den Zug ab (ein Anruf, eine Geste), gilt er nicht.
  window.addEventListener("pointercancel", (event) => {
    if (!state.zielen || state.zielen.zeiger !== event.pointerId) return;
    state.zielen = null;
    meldeZug(6);
  });

  // Mit der Tastatur: Pfeile links und rechts drehen, auf und ab spannen,
  // die Leertaste schiebt. Mit der Umschalttaste in feinen Schritten.
  window.addEventListener("keydown", (event) => {
    if (event.target.closest?.("button, a, input") || host.querySelector(".cm-overlay") || zuschauer) return;
    if (state.phase === "aufgabe") {
      const pfeil = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key];
      if (pfeil) {
        if (state.zielen && state.zielen.zeiger !== "taste") return;
        if (seit() < SPERRE) return;
        event.preventDefault();
        if (!state.zielen) state.zielen = { zeiger: "taste", x: 0, y: 0, winkel: 0, kraft: 0.5 };
        const fein = event.shiftKey ? 0.2 : 1;
        const z = state.zielen;
        const zug = zugVon(clamp(z.winkel + pfeil[0] * fein * GRAD, -Math.PI / 2, Math.PI / 2), clamp(z.kraft + pfeil[1] * fein * 0.01, 0, 1));
        Object.assign(z, zugZu(zug));
        meldeLage(zug.a, zug.b);
        return;
      }
      if ((event.key === " " || event.key === "Enter") && !event.repeat && state.zielen?.zeiger === "taste") {
        event.preventDefault();
        zielEnde();
      } else if (event.key === "Escape" && state.zielen?.zeiger === "taste") {
        state.zielen = null;
        meldeZug(6);
      }
      return;
    }
    if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
    if (state.phase === "bereit" || state.phase === "vorschau" || state.phase === "zeigen") { event.preventDefault(); tippe(); }
  });

  // Ist die Seite nicht zu sehen, schweigt das Gleiten.
  document.addEventListener("visibilitychange", () => { if (document.hidden) gleiten?.laut(0); });

  // Für die Prüfung (scripts/check-spiele.mjs) und die Vorführung.
  window.LernappEisstock = {
    ARTEN: [...LEICHT, ...MITTEL, ...SCHWER], LEICHT, MITTEL, SCHWER, PLAN, BAHNEN, ZEITEN, KNOTEN, RINGE, GENAU,
    BREIT, LANG, RADIUS, START_Y, WEIT, TEMPO, TAKT, KRAFT_MIN, EINZUG, SPERRE, VORSCHAU, ZEIGEN_MS, ZUG_TEIL,
    state, view, lege, bahnenFuer, weltText, weltFuer, schiebe, schritt, simuliere, suche, loese, punkteFuer, abstandVon, zugVon, zugZu,
    losGehts, bahnLos, zielBeginn, zielZu, zielEnde, schiebeAb, weiter, takt, zeichnen,
    // Die Bildschärfe festhalten (für Standbilder und Filme).
    guete(wert) { view.guete = clamp(wert, 0.4, 1); view.fest = true; view.cssW = 0; messen(); },
    // Wo ein Punkt der Bahn (Meter) im Bild liegt.
    imBild: (x, y) => ortIn({ x: view.eis.x, y: view.eis.y, s: view.eis.s, quer: view.quer }, x, y),
  };
})();
