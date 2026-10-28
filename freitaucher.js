/*
 * freitaucher.js – Freitaucher.
 * ---------------------------------------------------------------------------
 * Ein Atemzug, so tief du dich traust. Nur was du wieder nach oben bringst,
 * zählt.
 *
 * Eine Runde sind fünf Tauchgänge an fünf Plätzen: Bucht, Riffkante,
 * Quallenfeld, Muränenriff und zum Schluss ein Nachttauchgang. Auf dem Grund
 * liegen Muscheln mit Perlen – je tiefer, desto wertvoller (1, 2, 3, 5, 8).
 * Was der Taucher einsammelt, trägt er im Netz; gezählt wird es erst, wenn er
 * wieder an der Oberfläche ist. Geht ihm unterwegs die Luft aus, ist es ein
 * Blackout: Das Netz ist weg, und die Runde ist vorbei.
 *
 * Gesteuert wird mit einem Finger: Halten heisst schwimmen – zur Stelle, auf
 * der der Finger liegt, mit einem Flossenschlag nach dem anderen. Loslassen
 * heisst gleiten. Jeder Schlag kostet Luft, Gleiten fast keine.
 *
 * Der Kern ist das Wasser selbst, wie beim echten Freitauchen: Oben treibt
 * der Taucher nach oben – die Lunge ist voll Luft. Ab NEUTRAL Metern ist sie
 * so zusammengedrückt, dass er schwebt, und darunter sinkt er von selbst,
 * immer schneller. Hinunter ist also leicht: ein paar Schläge, dann den
 * Freifall geniessen. Hinauf ist teuer: Aus der Tiefe zieht es ihn zurück,
 * jeder Schlag gegen den Sog. Wer weiss, wann er umkehren muss, taucht tief.
 * Der weisse Strich am Luftring sagt, wie viel Luft der Weg nach oben kostet.
 *
 * Mit jedem Platz geht es tiefer, und das Wasser wird unfreundlicher: eine
 * Strömung, die quer zieht, Quallen, die stechen (Luft weg, kurz kein
 * Schlag), Muränen, die aus ihrem Fels schiessen und eine Perle aus dem Netz
 * reissen, und am Schluss die Nacht, in der nur die Perlen und die Quallen
 * leuchten. Wer zu lange an der Oberfläche liegt, lässt den Platz aus.
 *
 * Die Plätze kommen aus dem Zufall (zufall.js): Grund, Felsen, Muscheln,
 * Strömung, Quallen und Muränen. Jeder Platz zieht immer gleich viele Zahlen –
 * ohne Turnier jedes Mal anders, im Turnier für alle im selben Versuch
 * dieselben.
 *
 * Gerechnet wird in Metern: x nach rechts, y nach oben, die Oberfläche bei 0
 * (die Tiefe ist -y). Die Boje mit der Leine steht bei x = 0.
 *
 * Die Gegner (geist.js) tauchen als halb durchsichtige Taucher mit (a, b: Ort
 * in Dezimetern, die Plätze hintereinander, ABSTAND Meter auseinander; c: die
 * Richtung des Körpers mal 100). Zu sehen ist, wer gerade am selben Platz
 * taucht. Und die besten Runden lassen sich anschauen (?zuschauen=), mit
 * derselben Saat, also an denselben Plätzen.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "freedive") return;

  const host = document.querySelector("#fd-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Plätze ziehen daraus. Blasen, Plankton und das
  // Zittern in der Samba nehmen Math.random.
  const zufall = window.LernappZufall?.fuer?.("freeDive") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const ABSTAND = 200;             // so weit liegen die Plätze in der Aufzeichnung auseinander (m)
  const TAUCHGAENGE = 5;

  // Das Wasser und der Taucher.
  const C_WASSER = 0.13;           // Widerstand (je m): a = -C·|v|·v
  const KICK = 2.1;                // ein Flossenschlag gibt so viel Tempo (m/s)
  const KICK_TAKT = 0.4;           // so oft schlägt er, solange man hält (s)
  const AUF_OBEN = 1.4;            // Auftrieb an der Oberfläche (m/s²)
  const NEUTRAL = 11;              // in dieser Tiefe schwebt er (m)
  const AUF_MIN = -3.2;            // so stark zieht es ihn höchstens hinunter (m/s²)
  const R_TAUCHER = 0.45;          // so dick ist er für Grund, Fels und Quallen (m)
  const GREIF = 1.1;               // so nah muss eine Muschel an seinen Händen sein (m)
  const X_MIN = -18;
  const X_MAX = 56;

  // Die Luft: 1 ist ein voller Atemzug.
  const LUFT_S = 0.027;            // so viel kostet eine Sekunde unter Wasser
  const LUFT_KICK = 0.0095;        // und so viel jeder Schlag
  const SAMBA = 0.12;              // darunter verliert er die Kraft
  const OBEN_ZEIT = 8;             // so lange wartet ein Platz an der Oberfläche (s)
  const UNTEN_AB = 1.5;            // ab dieser Tiefe hat der Tauchgang begonnen (m)

  // Was eine Perle wert ist – nach der Tiefe ihrer Muschel.
  const WERTE = [[12, 1], [20, 2], [28, 3], [35, 5], [Infinity, 8]];
  const wertBei = (tiefe) => WERTE.find(([bis]) => tiefe < bis)[1];
  const PERLFARBE = { 1: "#fbf7ef", 2: "#ffc9dc", 3: "#9fd8ff", 5: "#ffd23f", 8: "#3a3346" };

  // Die fünf Plätze. tief: so tief ist der Grund am tiefsten, flach: das
  // Riffdach. Danach kommen dazu: Strömung, Quallen, Muränen, Nacht.
  const PLAETZE = [
    { name: "Bucht", tief: 21, flach: 6, stroemung: false, quallen: 0, muraenen: 0, nacht: false },
    { name: "Riffkante", tief: 28, flach: 8, stroemung: true, quallen: 0, muraenen: 0, nacht: false },
    { name: "Quallenfeld", tief: 34, flach: 9, stroemung: true, quallen: 5, muraenen: 0, nacht: false },
    { name: "Muränenriff", tief: 38, flach: 10, stroemung: true, quallen: 3, muraenen: 3, nacht: false },
    { name: "Nachttauchgang", tief: 42, flach: 10, stroemung: true, quallen: 4, muraenen: 3, nacht: true },
  ];
  const MUSCHELN = 9;
  const FELSEN = 6;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.freitaucher", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const glatt = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const naeher = (wert, ziel, rate, dt) => wert + (ziel - wert) * (1 - Math.exp(-rate * dt));

  // Zwei Farben (#rrggbb) gemischt: k = 0 die erste, 1 die zweite.
  function mische(a, b, k) {
    const zahl = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
    const teil = (i) => Math.round(zahl(a, i) + (zahl(b, i) - zahl(a, i)) * k).toString(16).padStart(2, "0");
    return `#${teil(0)}${teil(1)}${teil(2)}`;
  }

  // Immer dieselbe Zahl zu derselben Eingabe: Sand, Seegras, Plankton.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Ein Winkel auf dem kürzesten Weg zu einem anderen.
  function winkelZu(von, nach, rate, dt) {
    let d = nach - von;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return von + d * (1 - Math.exp(-rate * dt));
  }

  // Der Auftrieb in der Tiefe d (m/s², plus nach oben).
  const auftrieb = (d) => clamp(AUF_OBEN * (1 - d / NEUTRAL), AUF_MIN, AUF_OBEN);

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "oben" (an der Oberfläche, vor dem Tauchgang), "tauchen",
  //          "auf" (wieder oben, die Perlen werden gezählt), "blackout",
  //          "wechsel" (zum nächsten Platz)
  const state = {
    phase: "bereit",
    schritt: "oben",
    punkte: 0,               // die Perlen, die oben sind – die Zahl der Runde
    nr: 0,                   // der wievielte Tauchgang (ab 0)
    platz: null,             // der Platz dieses Tauchgangs
    plaetze: [],             // alle gewürfelten Plätze
    taucher: null,
    netz: [],                // die Perlen im Netz (Werte)
    halten: false,
    fingerX: 0,              // wo der Finger liegt (Bildpunkte)
    fingerY: 0,
    richtung: null,          // oder eine Richtung von den Tasten
    bedarf: 0,               // so viel Luft kostet der Weg nach oben
    luftring: 0,             // wie deutlich der Luftring steht (0 bis 1)
    obenRest: OBEN_ZEIT,
    weiterIn: 0,
    tiefeMax: 0,
    aus: "",                 // warum die Runde endet: "blackout", "fertig"
    ergebnisse: [],          // je Tauchgang die Perlen, die oben ankamen
    blende: 0,
    blendeZiel: 0,
    tv: null,
    teile: [],
    schriften: [],
    stoss: 0,
    rot: 0,                  // der rote Schimmer nach einem Stich oder Biss
    zeit: 0,
    echt: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let gegner = null;
  let zuschauer = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, nutzH: 0, minD: 1, ox: 0, oy: 0 };
  const kam = { x: 0, y: 0, z: 26, bereit: false };

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Plätze
  // ---------------------------------------------------------------------------
  /*
   * Je Platz zieht der Plan genau ZAHLEN_JE_PLATZ Zahlen, auch wenn er sie
   * nicht alle braucht – so hängt er nur an der Saat.
   *
   *   boden     die Tiefe des Grundes an der Stelle x: vom Riffdach über die
   *             Kante in die Tiefe, mit Wellen und einer Felsnadel, die
   *             irgendwo aus der Tiefe aufragt. Links wird es zum Ufer hin
   *             flach.
   *   felsen    Brocken auf dem Grund (Kreise), manche mit einer Muräne
   *   muscheln  auf dem Grund oder oben auf einem Felsen, mit ihrer Perle
   *   stroemung ein Band in der Tiefe (mitte, halb), das quer zieht (v, m/s)
   *   quallen   schweben auf und ab (amp, per) um ihre Tiefe
   */
  const ZAHLEN_JE_PLATZ = 120;

  function neuerPlatz(n) {
    const z = [];
    for (let i = 0; i < ZAHLEN_JE_PLATZ; i += 1) z.push(zufall.zahl());
    let k = 0;
    const nimm = () => z[k++];
    const art = PLAETZE[Math.min(n, PLAETZE.length - 1)];
    const tief = art.tief;
    const flach = art.flach;
    const kante = lerp(-2, 12, nimm());
    const breite = lerp(10, 20, nimm());
    const wellen = [0, 1, 2].map(() => ({ a: lerp(0.6, 2.2, nimm()), f: lerp(0.08, 0.3, nimm()), p: nimm() * Math.PI * 2 }));
    const nadel = { x: lerp(22, 40, nimm()), h: lerp(5, 11, nimm()), b: lerp(2.5, 5, nimm()) };
    const roh = (x) => {
      let d = lerp(flach, tief, glatt((x - kante) / breite));
      const ab = 0.4 + 0.6 * glatt((x - kante + 6) / 12);
      for (const w of wellen) d += w.a * Math.sin(x * w.f + w.p) * ab;
      d -= nadel.h * Math.exp(-(((x - nadel.x) / nadel.b) ** 2));
      d = lerp(2.5, d, glatt((x - X_MIN + 2) / 9));
      return clamp(d, 2.5, tief + 1.5);
    };
    // Der Grund, alle viertel Meter.
    const schritt = 0.25;
    const proben = [];
    for (let x = X_MIN - 8; x <= X_MAX + 8; x += schritt) proben.push(roh(x));
    const boden = (x) => {
      const u = (x - (X_MIN - 8)) / schritt;
      const i = clamp(Math.floor(u), 0, proben.length - 2);
      const f = clamp(u - i, 0, 1);
      return proben[i] + (proben[i + 1] - proben[i]) * f;
    };
    const felsen = [];
    for (let i = 0; i < FELSEN; i += 1) {
      const x = lerp(-10, 46, (i + 0.2 + nimm() * 0.6) / FELSEN);
      const r = lerp(0.9, 2.1, nimm());
      felsen.push({ x, r, y: -(boden(x) - r * 0.45), muraene: null });
    }
    const muscheln = [];
    for (let i = 0; i < MUSCHELN; i += 1) {
      const x = lerp(-14, 42, (i + 0.5 + (nimm() - 0.5) * 0.7) / MUSCHELN);
      let y = -(boden(x) - 0.3);
      // Liegt ein Fels darüber, liegt die Muschel oben auf ihm.
      for (const f of felsen) {
        if (Math.abs(f.x - x) < f.r * 0.8) y = Math.max(y, f.y + Math.sqrt(Math.max(0, f.r * f.r - (x - f.x) ** 2)) + 0.2);
      }
      const tiefe = -y;
      muscheln.push({ x, y, wert: wertBei(tiefe), tiefe, offen: false, leer: false, glanz: nimm() * 6 });
    }
    const st = { mitte: -lerp(7, tief - 9, nimm()), halb: lerp(2.5, 4, nimm()), v: (nimm() < 0.5 ? -1 : 1) * lerp(0.9, 1.3, nimm()) * (0.85 + 0.12 * n) };
    const stroemung = art.stroemung ? st : null;
    const quallen = [];
    for (let i = 0; i < 8; i += 1) {
      const q = { x: lerp(-8, 42, nimm()), y: -lerp(5, tief - 6, nimm()), amp: lerp(0.8, 2, nimm()), per: lerp(5, 9, nimm()), ph: nimm() * Math.PI * 2, r: lerp(0.5, 0.75, nimm()) };
      if (i < art.quallen) quallen.push(q);
    }
    const muraenen = [];
    for (let i = 0; i < 4; i += 1) {
      const welcher = Math.floor(nimm() * FELSEN);
      const seite = nimm() < 0.5 ? -1 : 1;
      if (i < art.muraenen && !felsen[welcher].muraene) {
        const f = felsen[welcher];
        const m = { fels: welcher, seite, x: f.x + seite * f.r * 0.8, y: f.y + f.r * 0.15, raus: 0, ruhe: 0, biss: false };
        f.muraene = m;
        muraenen.push(m);
      }
    }
    return { n, art, tief, flach, kante, boden, felsen, muscheln, stroemung, quallen, muraenen };
  }

  function plaetzeBis(n) {
    while (state.plaetze.length <= n) state.plaetze.push(neuerPlatz(state.plaetze.length));
  }

  // Wo eine Qualle gerade ist: Sie schwebt auf und ab, ein wenig zur Seite.
  function quallenOrt(q, t) {
    const u = (t / q.per) * Math.PI * 2 + q.ph;
    return { x: q.x + Math.sin(u * 0.5) * 1.2, y: q.y + Math.sin(u) * q.amp };
  }

  // Die gewürfelte Welt in Worten: Grund, Muscheln und Gefahren der ersten
  // drei Plätze. Im Turnier bekommen alle denselben Text.
  function weltText() {
    plaetzeBis(2);
    return state.plaetze.slice(0, 3).map((p) => `${p.art.name} k${p.kante.toFixed(1)} `
      + p.muscheln.map((m) => `${m.x.toFixed(1)}/${m.tiefe.toFixed(1)}:${m.wert}`).join(",")
      + (p.stroemung ? ` s${p.stroemung.mitte.toFixed(1)}/${p.stroemung.v.toFixed(2)}` : "")
      + (p.quallen.length ? ` q${p.quallen.map((q) => `${q.x.toFixed(1)}/${q.y.toFixed(1)}`).join(",")}` : "")).join(" | ");
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  let promptKnoten = null;

  function buildPlatz() {
    feld = shell.el("div", "fd-feld");
    canvas = document.createElement("canvas");
    canvas.className = "fd-canvas";
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
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    view.nutzH = cssH - frei;
    view.minD = Math.min(cssW, view.nutzH);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    kam.bereit = false;
  }

  const wackelX = () => (ruhig() ? 0 : Math.sin(state.echt * 61) * 6 * state.stoss * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.cos(state.echt * 47) * 6 * state.stoss * state.stoss);

  // Welt (Meter, y nach oben) auf die Leinwand (CSS-Pixel) und zurück.
  const bildX = (x) => x * kam.z + view.ox;
  const bildY = (y) => view.oy - y * kam.z;
  const weltX = (X) => (X - view.ox) / kam.z;
  const weltY = (Y) => (view.oy - Y) / kam.z;

  function kameraSetzen() {
    view.ox = view.cssW / 2 - kam.x * kam.z + wackelX();
    view.oy = view.frei + view.nutzH / 2 + kam.y * kam.z + wackelY();
  }

  function flach() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  /*
   * Die Kamera folgt dem Taucher, ein Stück in die Richtung, in die er
   * schwimmt. Über die Oberfläche hinaus zeigt sie nur einen Streifen Himmel:
   * Die Wasserlinie steht nie tiefer als OBEN_RAND.
   */
  const OBEN_RAND = 0.24;
  function kameraTakt(dt, sofort = false) {
    const t = state.taucher;
    if (!t) return;
    const quer = view.cssW > view.nutzH;
    const z = Math.min(view.nutzH / (quer ? 15 : 19), view.cssW / (quer ? 13 : 9));
    const vorX = clamp(t.vx * 0.5, -3, 3);
    const vorY = clamp(t.vy * 0.35, -2.5, 2.5);
    const zielX = t.x + vorX;
    // So hoch darf die Mitte des Bildes höchstens stehen, damit die
    // Wasserlinie nicht unter OBEN_RAND rutscht.
    const hoechstens = -((0.5 - OBEN_RAND) * view.nutzH) / z;
    const zielY = Math.min(t.y + vorY, hoechstens);
    if (sofort || !kam.bereit) {
      kam.z = z;
      kam.x = zielX;
      kam.y = zielY;
      kam.bereit = true;
    } else {
      kam.z = naeher(kam.z, z, 3, dt);
      kam.x = naeher(kam.x, zielX, 3.2, dt);
      kam.y = naeher(kam.y, zielY, 3.2, dt);
    }
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Himmel, Wasser, Grund
  // ---------------------------------------------------------------------------
  // Die Farbe des Wassers nach der Tiefe – tags türkis bis tiefblau, nachts
  // von Anfang an dunkel.
  const WASSER_TAG = [[0, "#4cc9d9"], [8, "#2196b6"], [18, "#136b97"], [30, "#0b3e6b"], [42, "#06213f"], [60, "#030c1c"]];
  const WASSER_NACHT = [[0, "#16406a"], [10, "#0c2648"], [24, "#07152e"], [45, "#020814"], [60, "#01040b"]];
  const nacht = () => Boolean(state.platz?.art.nacht);

  function zeichneHimmel() {
    const oben = bildY(0);
    if (oben <= 0) return;
    const n = nacht();
    const h = g.createLinearGradient(0, 0, 0, oben);
    h.addColorStop(0, n ? "#03071a" : "#3f8fe0");
    h.addColorStop(1, n ? "#1a2a58" : "#cfeaff");
    g.fillStyle = h;
    g.fillRect(0, 0, view.cssW, oben);
    if (n) {
      g.fillStyle = "#ffffff";
      for (let i = 0; i < 60; i += 1) {
        const y = hash01(i * 5.3 + 2) * oben * 0.9;
        g.globalAlpha = 0.3 + hash01(i * 9.1) * 0.6;
        g.fillRect(hash01(i * 3.7 + 1) * view.cssW, y, 1.3, 1.3);
      }
      g.globalAlpha = 1;
      g.fillStyle = "#f4f1ff";
      g.beginPath();
      g.arc(view.cssW * 0.8, oben * 0.35, 12, 0, Math.PI * 2);
      g.fill();
    } else {
      const sx = view.cssW * 0.78;
      const sy = Math.min(oben * 0.35, 60);
      const hof = g.createRadialGradient(sx, sy, 4, sx, sy, 70);
      hof.addColorStop(0, "rgba(255, 248, 220, 0.9)");
      hof.addColorStop(1, "rgba(255, 248, 220, 0)");
      g.fillStyle = hof;
      g.fillRect(sx - 70, sy - 70, 140, 140);
      g.fillStyle = "#fffbe8";
      g.beginPath();
      g.arc(sx, sy, 15, 0, Math.PI * 2);
      g.fill();
    }
    // Die Küste in der Ferne: Hügel, eine Insel.
    g.fillStyle = n ? "#0b1530" : "#6f9cb8";
    g.beginPath();
    g.moveTo(0, oben);
    for (let X = 0; X <= view.cssW + 10; X += 10) {
      const wx = X * 0.6 + kam.x * 2;
      const hoehe = 14 + Math.sin(wx * 0.011) * 10 + Math.sin(wx * 0.037 + 1) * 5;
      g.lineTo(X, oben - Math.max(0, hoehe));
    }
    g.lineTo(view.cssW, oben);
    g.closePath();
    g.fill();
  }

  function zeichneWasser() {
    const oben = Math.max(0, bildY(0));
    if (oben >= view.cssH) return;
    const stufen = nacht() ? WASSER_NACHT : WASSER_TAG;
    const y0 = bildY(0);
    const y1 = bildY(-60);
    const verlauf = g.createLinearGradient(0, y0, 0, y1);
    for (const [tiefe, farbe] of stufen) verlauf.addColorStop(clamp(tiefe / 60, 0, 1), farbe);
    g.fillStyle = verlauf;
    g.fillRect(0, oben, view.cssW, view.cssH - oben);
    // Licht, das schräg ins Wasser fällt – oben stark, in der Tiefe weg.
    if (!ruhig() && !nacht()) {
      g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 7; i += 1) {
        const wx = (hash01(i * 4.1) - 0.2) * 90 + Math.sin(state.echt * 0.3 + i) * 1.2;
        const X = bildX(wx);
        const breit = (1.2 + hash01(i * 2.7) * 2.5) * kam.z;
        const lang = (14 + hash01(i * 6.1) * 14) * kam.z;
        if (X + lang < -50 || X - breit > view.cssW + 50) continue;
        const s = g.createLinearGradient(0, y0, 0, y0 + lang);
        s.addColorStop(0, "rgba(200, 250, 255, 0.11)");
        s.addColorStop(1, "rgba(200, 250, 255, 0)");
        g.fillStyle = s;
        g.beginPath();
        g.moveTo(X, y0);
        g.lineTo(X + breit, y0);
        g.lineTo(X + breit * 0.3 + lang * 0.22, y0 + lang);
        g.lineTo(X - breit * 0.5 + lang * 0.22, y0 + lang);
        g.closePath();
        g.fill();
      }
      g.globalCompositeOperation = "source-over";
    }
  }

  // Die Wasserlinie mit kleinen Wellen, von unten hell.
  function zeichneOberflaeche() {
    const y0 = bildY(0);
    if (y0 < -10 || y0 > view.cssH + 10) return;
    const z = kam.z;
    g.strokeStyle = nacht() ? "rgba(160, 190, 255, 0.55)" : "rgba(235, 255, 255, 0.9)";
    g.lineWidth = Math.max(1.5, 0.08 * z);
    g.beginPath();
    for (let X = 0; X <= view.cssW + 8; X += 8) {
      const wx = weltX(X);
      const y = y0 + Math.sin(wx * 1.3 + state.echt * 2) * 0.07 * z + Math.sin(wx * 0.4 - state.echt * 1.1) * 0.06 * z;
      if (X === 0) g.moveTo(X, y); else g.lineTo(X, y);
    }
    g.stroke();
  }

  // Das Boot, die Boje und die Leine mit den Marken alle zehn Meter.
  function zeichneBojeUndBoot() {
    const z = kam.z;
    const p = state.platz;
    const wipp = Math.sin(state.echt * 1.4) * 0.06;
    // Die Leine.
    const tief = p ? p.boden(0) - 0.5 : 20;
    g.strokeStyle = "rgba(255, 240, 200, 0.55)";
    g.lineWidth = Math.max(1, 0.05 * z);
    g.beginPath();
    g.moveTo(bildX(0), bildY(wipp));
    g.lineTo(bildX(0), bildY(-tief));
    g.stroke();
    g.font = `800 ${Math.round(clamp(0.4 * z, 9, 13))}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    for (let d = 10; d < tief; d += 10) {
      const Y = bildY(-d);
      if (Y < -10 || Y > view.cssH + 10) continue;
      g.fillStyle = "#ffd23f";
      g.fillRect(bildX(0) - 0.15 * z, Y - 0.1 * z, 0.3 * z, 0.2 * z);
      g.fillStyle = "rgba(255, 255, 255, 0.7)";
      g.fillText(`${d} m`, bildX(0) + 0.3 * z, Y);
    }
    // Die Boje.
    g.fillStyle = "#ff7a2f";
    g.beginPath();
    g.arc(bildX(0), bildY(wipp + 0.1), Math.max(3, 0.45 * z), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(bildX(-0.45), bildY(wipp + 0.15), 0.9 * z, Math.max(1, 0.12 * z));
    g.strokeStyle = "#d8d8d8";
    g.beginPath();
    g.moveTo(bildX(0), bildY(wipp + 0.4));
    g.lineTo(bildX(0), bildY(wipp + 1.9));
    g.stroke();
    g.fillStyle = "#e8262f";
    g.fillRect(bildX(0), bildY(wipp + 1.9), 0.75 * z, 0.5 * z);
    // Das Boot, links von der Boje.
    const bx = -6;
    const unten = wipp - 0.4;
    g.fillStyle = nacht() ? "#3a4366" : "#f4f1ea";
    g.beginPath();
    g.moveTo(bildX(bx - 2.6), bildY(unten + 1.1));
    g.lineTo(bildX(bx + 2.8), bildY(unten + 1.1));
    g.lineTo(bildX(bx + 2.1), bildY(unten));
    g.lineTo(bildX(bx - 2.1), bildY(unten));
    g.closePath();
    g.fill();
    g.fillStyle = nacht() ? "#22284a" : "#1f5fd6";
    g.fillRect(bildX(bx - 2.5), bildY(unten + 0.85), 5.2 * z, Math.max(1, 0.15 * z));
    g.fillStyle = nacht() ? "#2c3358" : "#d8d2c4";
    g.fillRect(bildX(bx - 1.2), bildY(unten + 2.1), 1.9 * z, 1 * z);
    if (nacht()) {
      g.globalCompositeOperation = "lighter";
      const lx = bildX(bx + 0.6);
      const ly = bildY(unten + 2.6);
      const r = Math.max(10, 1.5 * z);
      const hof = g.createRadialGradient(lx, ly, 1, lx, ly, r);
      hof.addColorStop(0, "rgba(255, 220, 140, 0.9)");
      hof.addColorStop(1, "rgba(255, 220, 140, 0)");
      g.fillStyle = hof;
      g.fillRect(lx - r, ly - r, r * 2, r * 2);
      g.globalCompositeOperation = "source-over";
    }
  }

  // Der Grund: Sand oben, Fels und Schlamm in der Tiefe, Korallen auf dem
  // Riffdach, Seegras, das in der Strömung wiegt.
  function zeichneGrund() {
    const p = state.platz;
    if (!p) return;
    const z = kam.z;
    const x0 = weltX(-20);
    const x1 = weltX(view.cssW + 20);
    const schritt = Math.max(0.25, 6 / z);
    const n = nacht();
    const verlauf = g.createLinearGradient(0, bildY(-4), 0, bildY(-44));
    verlauf.addColorStop(0, n ? "#3d4660" : "#e3cf98");
    verlauf.addColorStop(0.35, n ? "#262c44" : "#a99a76");
    verlauf.addColorStop(1, n ? "#0b0f1c" : "#2a3442");
    g.fillStyle = verlauf;
    g.beginPath();
    g.moveTo(bildX(x0), view.cssH + 10);
    for (let x = x0; x <= x1 + schritt; x += schritt) g.lineTo(bildX(x), bildY(-p.boden(x)));
    g.lineTo(bildX(x1 + schritt), view.cssH + 10);
    g.closePath();
    g.fill();
    // Kiesel und Flecken auf dem Grund.
    const a = Math.floor(x0 / 0.6);
    const b = Math.ceil(x1 / 0.6);
    for (let i = a; i <= b; i += 1) {
      const x = i * 0.6 + hash01(i * 1.3) * 0.4;
      const d = p.boden(x);
      const Y = bildY(-d) + (0.1 + hash01(i * 2.9) * 0.5) * z;
      g.fillStyle = `rgba(0, 0, 0, ${0.08 + hash01(i * 7.1) * 0.1})`;
      g.beginPath();
      g.ellipse(bildX(x), Y, Math.max(1, (0.1 + hash01(i) * 0.15) * z), Math.max(0.6, 0.06 * z), 0, 0, Math.PI * 2);
      g.fill();
      // Korallen auf dem Riffdach, Seegras etwas tiefer.
      const r = hash01(i * 3.7 + 11);
      if (d < 16 && r < 0.3) zeichneKoralle(x, -d, i);
      else if (d < 30 && r > 0.82) zeichneSeegras(x, -d, i);
    }
  }

  const KORALLEN = ["#ff7a6b", "#ffb347", "#c77dff", "#ff5fa2", "#ffd23f"];
  function zeichneKoralle(x, y, i) {
    const z = kam.z;
    const X = bildX(x);
    const Y = bildY(y);
    const hoch = (0.5 + hash01(i * 5.5) * 0.7) * z;
    g.strokeStyle = nacht() ? "#4a3a66" : KORALLEN[i % KORALLEN.length];
    g.lineWidth = Math.max(1.2, 0.12 * z);
    g.lineCap = "round";
    g.beginPath();
    for (let k = -1; k <= 1; k += 1) {
      g.moveTo(X, Y);
      const spitzeX = X + k * hoch * 0.45;
      const spitzeY = Y - hoch * (1 - Math.abs(k) * 0.25);
      g.quadraticCurveTo(X + k * hoch * 0.1, Y - hoch * 0.5, spitzeX, spitzeY);
    }
    g.stroke();
    g.lineCap = "butt";
  }

  function zeichneSeegras(x, y, i) {
    const z = kam.z;
    const X = bildX(x);
    const Y = bildY(y);
    const hoch = (1.2 + hash01(i * 4.4) * 1.6) * z;
    const zug = (state.platz?.stroemung ? state.platz.stroemung.v * 0.25 : 0) * z;
    g.strokeStyle = nacht() ? "#1d3a3a" : "#3d8a4d";
    g.lineWidth = Math.max(1, 0.08 * z);
    for (let k = 0; k < 3; k += 1) {
      const w = Math.sin(state.echt * 1.2 + i + k) * 0.3 * z;
      g.beginPath();
      g.moveTo(X + k * 0.12 * z, Y);
      g.quadraticCurveTo(X + w + zug * 0.5, Y - hoch * 0.5, X + w * 1.6 + zug + k * 0.1 * z, Y - hoch * (0.8 + k * 0.1));
      g.stroke();
    }
  }

  // Die Felsen, und in manchen eine Muräne: Im Loch glänzen ihre Augen,
  // schiesst sie heraus, steht ihr Leib grün gefleckt im Wasser.
  function zeichneFelsen() {
    const p = state.platz;
    if (!p) return;
    const z = kam.z;
    const n = nacht();
    for (const f of p.felsen) {
      const X = bildX(f.x);
      const Y = bildY(f.y);
      const r = f.r * z;
      if (X + r < -20 || X - r > view.cssW + 20 || Y - r > view.cssH + 20 || Y + r < -20) continue;
      const verlauf = g.createRadialGradient(X - r * 0.3, Y - r * 0.4, r * 0.1, X, Y, r);
      verlauf.addColorStop(0, n ? "#3a4058" : "#7a8796");
      verlauf.addColorStop(1, n ? "#141828" : "#36404c");
      g.fillStyle = verlauf;
      g.beginPath();
      for (let k = 0; k <= 12; k += 1) {
        const w = (k / 12) * Math.PI * 2;
        const rr = r * (0.88 + hash01(f.x * 3 + k) * 0.18);
        if (k === 0) g.moveTo(X + Math.cos(w) * rr, Y + Math.sin(w) * rr * 0.85);
        else g.lineTo(X + Math.cos(w) * rr, Y + Math.sin(w) * rr * 0.85);
      }
      g.closePath();
      g.fill();
      const m = f.muraene;
      if (m) {
        const hx = bildX(m.x);
        const hy = bildY(m.y);
        g.fillStyle = "#05080f";
        g.beginPath();
        g.ellipse(hx, hy, 0.35 * z, 0.28 * z, 0, 0, Math.PI * 2);
        g.fill();
        zeichneMuraene(m);
      }
    }
  }

  function zeichneMuraene(m) {
    const z = kam.z;
    const raus = m.raus;
    const kx = m.x + m.seite * raus * 2.2 + m.seite * 0.15;
    const ky = m.y + Math.sin(raus * 3) * 0.2;
    if (raus > 0.02) {
      g.strokeStyle = "#5b7a2e";
      g.lineWidth = Math.max(2, 0.32 * z);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(bildX(m.x), bildY(m.y));
      g.quadraticCurveTo(bildX((m.x + kx) / 2), bildY(m.y + Math.sin(state.echt * 9) * 0.2 * raus), bildX(kx), bildY(ky));
      g.stroke();
      g.strokeStyle = "rgba(255, 230, 120, 0.4)";
      g.lineWidth = Math.max(1, 0.08 * z);
      g.setLineDash([0.1 * z, 0.25 * z]);
      g.stroke();
      g.setLineDash([]);
      g.lineCap = "butt";
      g.fillStyle = "#6d8c38";
      g.beginPath();
      g.ellipse(bildX(kx), bildY(ky), 0.3 * z, 0.2 * z, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Die Augen: auch im Loch und im Dunkeln zu sehen.
    g.fillStyle = "#ffe066";
    g.beginPath();
    g.arc(bildX(kx + m.seite * 0.1), bildY(ky + 0.07), Math.max(1.2, 0.06 * z), 0, Math.PI * 2);
    g.fill();
  }

  // Die Muscheln. Nah am Taucher klappen sie auf und zeigen ihre Perle;
  // eine leere bleibt offen.
  function zeichneMuscheln() {
    const p = state.platz;
    if (!p) return;
    const z = kam.z;
    for (const m of p.muscheln) {
      const X = bildX(m.x);
      const Y = bildY(m.y);
      if (X < -30 || X > view.cssW + 30 || Y < -30 || Y > view.cssH + 30) continue;
      const w = 0.42 * z;
      const auf = m.leer ? 1 : m.auf || 0;
      g.fillStyle = nacht() ? "#4c4a66" : "#8d7a6a";
      g.beginPath();
      g.ellipse(X, Y, w, w * 0.45, 0, 0, Math.PI);
      g.fill();
      if (!m.leer) {
        g.fillStyle = PERLFARBE[m.wert];
        g.beginPath();
        g.arc(X, Y - w * 0.12, w * 0.32, 0, Math.PI * 2);
        g.fill();
      }
      g.save();
      g.translate(X - w, Y);
      g.rotate(-auf * 0.9);
      g.fillStyle = nacht() ? "#5c5a78" : "#a8927e";
      g.beginPath();
      g.ellipse(w, 0, w, w * 0.45, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(255, 255, 255, 0.25)";
      g.lineWidth = 1;
      g.beginPath();
      for (let k = -2; k <= 2; k += 1) {
        g.moveTo(w, 0);
        g.lineTo(w + k * w * 0.35, -w * 0.4);
      }
      g.stroke();
      g.restore();
    }
  }

  // Der Glanz der Perlen: über dem Dunkel, damit man sie von weitem sieht –
  // je wertvoller, desto grösser.
  function zeichneGlanz() {
    const p = state.platz;
    const t = state.taucher;
    if (!p || !t) return;
    const z = kam.z;
    g.globalCompositeOperation = "lighter";
    for (const m of p.muscheln) {
      if (m.leer) continue;
      const X = bildX(m.x);
      const Y = bildY(m.y) - 0.05 * z;
      if (X < -30 || X > view.cssW + 30 || Y < -30 || Y > view.cssH + 30) continue;
      const puls = 0.55 + 0.45 * Math.sin(state.echt * 2.4 + m.glanz);
      const r = (0.5 + m.wert * 0.12) * z * (0.8 + 0.3 * puls);
      const farbe = m.wert === 8 ? "190, 160, 255" : m.wert === 5 ? "255, 215, 90" : m.wert === 3 ? "150, 215, 255" : "255, 245, 230";
      const hof = g.createRadialGradient(X, Y, 1, X, Y, r);
      hof.addColorStop(0, `rgba(${farbe}, ${0.55 * puls})`);
      hof.addColorStop(1, `rgba(${farbe}, 0)`);
      g.fillStyle = hof;
      g.fillRect(X - r, Y - r, r * 2, r * 2);
    }
    // Nachts leuchten auch die Quallen.
    if (nacht()) {
      for (const q of p.quallen) {
        const o = quallenOrt(q, state.zeit);
        const X = bildX(o.x);
        const Y = bildY(o.y);
        const r = q.r * 2.4 * z;
        const hof = g.createRadialGradient(X, Y, 1, X, Y, r);
        hof.addColorStop(0, "rgba(200, 120, 255, 0.4)");
        hof.addColorStop(1, "rgba(200, 120, 255, 0)");
        g.fillStyle = hof;
        g.fillRect(X - r, Y - r, r * 2, r * 2);
      }
    }
    g.globalCompositeOperation = "source-over";
  }

  // Die Quallen: ein durchsichtiger Schirm, der pumpt, und Fäden, die
  // hinterherwehen.
  function zeichneQuallen() {
    const p = state.platz;
    if (!p) return;
    const z = kam.z;
    for (const q of p.quallen) {
      const o = quallenOrt(q, state.zeit);
      const X = bildX(o.x);
      const Y = bildY(o.y);
      const r = q.r * z;
      if (X < -r * 3 || X > view.cssW + r * 3 || Y < -r * 4 || Y > view.cssH + r * 4) continue;
      const pump = 1 + Math.sin(state.zeit * 3 + q.ph) * 0.08;
      g.strokeStyle = "rgba(255, 170, 230, 0.5)";
      g.lineWidth = Math.max(1, 0.05 * z);
      for (let k = -2; k <= 2; k += 1) {
        g.beginPath();
        g.moveTo(X + k * r * 0.3, Y);
        const w = Math.sin(state.zeit * 2 + k + q.ph) * r * 0.3;
        g.quadraticCurveTo(X + k * r * 0.35 + w, Y + r * 1.2, X + k * r * 0.25 - w, Y + r * 2.4);
        g.stroke();
      }
      g.fillStyle = "rgba(255, 150, 220, 0.55)";
      g.beginPath();
      g.ellipse(X, Y, r * pump, r * 0.75 / pump, 0, Math.PI, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255, 220, 245, 0.6)";
      g.beginPath();
      g.ellipse(X, Y - r * 0.25, r * 0.45, r * 0.25, 0, Math.PI, Math.PI * 2);
      g.fill();
    }
  }

  // Die Strömung: helle Striche, die quer durch ihr Band ziehen.
  function zeichneStroemung() {
    const s = state.platz?.stroemung;
    if (!s) return;
    const z = kam.z;
    const oben = bildY(s.mitte + s.halb);
    const unten = bildY(s.mitte - s.halb);
    if (unten < -20 || oben > view.cssH + 20) return;
    g.lineCap = "round";
    for (let i = 0; i < 26; i += 1) {
      const v = hash01(i * 2.3 + 0.7);
      const y = s.mitte - s.halb + 2 * s.halb * (0.1 + 0.8 * v);
      const lauf = (state.echt * (0.12 + hash01(i * 4.1) * 0.08) * Math.sign(s.v) + hash01(i * 6.7)) % 1;
      const u = (lauf + 1) % 1;
      const wx = weltX(0) + u * (view.cssW / z + 8) - 4;
      const lang = (1 + hash01(i * 5.3) * 1.5) * Math.sign(s.v) * z;
      const a = Math.sin(Math.PI * u) * Math.sin(Math.PI * (0.1 + 0.8 * v)) * 0.35;
      g.strokeStyle = `rgba(210, 245, 255, ${a})`;
      g.lineWidth = Math.max(1, 0.06 * z);
      g.beginPath();
      g.moveTo(bildX(wx) - lang, bildY(y));
      g.lineTo(bildX(wx), bildY(y));
      g.stroke();
    }
    g.lineCap = "butt";
  }

  // Plankton und Schwebeteilchen: im Bild, mit der Kamera ein wenig
  // verschoben – sie zeigen, dass man sich bewegt.
  function zeichnePlankton() {
    if (ruhig()) return;
    const n = nacht();
    const oben = Math.max(0, bildY(0));
    for (let i = 0; i < 70; i += 1) {
      const tiefe = 0.3 + hash01(i * 7.7) * 0.7;
      const x = ((hash01(i * 3.1) * view.cssW * 1.4 - kam.x * kam.z * tiefe * 0.6 + state.echt * 4 * tiefe) % (view.cssW * 1.4) + view.cssW * 1.4) % (view.cssW * 1.4) - view.cssW * 0.2;
      const y = ((hash01(i * 5.9) * view.cssH * 1.4 + kam.y * kam.z * tiefe * 0.6 - state.echt * 3 * tiefe) % (view.cssH * 1.4) + view.cssH * 1.4) % (view.cssH * 1.4) - view.cssH * 0.2;
      if (y < oben) continue;
      g.fillStyle = n ? `rgba(120, 255, 220, ${0.25 + tiefe * 0.4})` : `rgba(230, 250, 255, ${0.15 + tiefe * 0.25})`;
      g.fillRect(x, y, 1 + tiefe * 1.4, 1 + tiefe * 1.4);
    }
  }

  // Ein Schwarm kleiner Fische, der um einen Punkt kreist.
  function zeichneSchwarm() {
    const p = state.platz;
    if (!p || nacht()) return;
    const z = kam.z;
    const mx = 18 + Math.sin(state.echt * 0.05) * 8;
    const my = -6 - Math.sin(state.echt * 0.07) * 2;
    g.fillStyle = "rgba(220, 240, 255, 0.75)";
    for (let i = 0; i < 16; i += 1) {
      const w = state.echt * 0.6 + (i / 16) * Math.PI * 2;
      const r = 1.6 + hash01(i * 3.3) * 1.4;
      const x = mx + Math.cos(w) * r * 1.6;
      const y = my + Math.sin(w) * r * 0.6;
      const X = bildX(x);
      const Y = bildY(y);
      if (X < -10 || X > view.cssW + 10 || Y < -10 || Y > view.cssH + 10) continue;
      const d = -Math.sin(w) >= 0 ? 1 : -1;
      g.beginPath();
      g.ellipse(X, Y, 0.22 * z, 0.08 * z, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(X - d * 0.2 * z, Y);
      g.lineTo(X - d * 0.36 * z, Y - 0.09 * z);
      g.lineTo(X - d * 0.36 * z, Y + 0.09 * z);
      g.closePath();
      g.fill();
    }
  }

  // Das Dunkel der Tiefe: Rings um den Taucher bleibt ein Kreis Sicht, je
  // tiefer, desto kleiner. Nachts trägt er eine Lampe.
  function zeichneDunkel() {
    const t = state.taucher;
    if (!t) return;
    const d = Math.max(0, -t.y);
    const n = nacht();
    const dunkel = n ? 0.62 + 0.3 * clamp(d / 25, 0, 1) : clamp((d - 8) / 34, 0, 0.88);
    if (dunkel <= 0.01) return;
    const X = bildX(t.x);
    const Y = bildY(t.y);
    const sicht = (n ? 6 : lerp(26, 8, clamp(d / 42, 0, 1))) * kam.z;
    const verlauf = g.createRadialGradient(X, Y, sicht * 0.35, X, Y, sicht * 1.15);
    verlauf.addColorStop(0, "rgba(2, 8, 20, 0)");
    verlauf.addColorStop(1, `rgba(2, 8, 20, ${dunkel})`);
    g.fillStyle = verlauf;
    g.fillRect(0, 0, view.cssW, view.cssH);
    if (n && d > 0.5) {
      // Der Kegel der Lampe, in Blickrichtung.
      g.globalCompositeOperation = "lighter";
      const w = -t.winkel;
      const lang = 7 * kam.z;
      const kegel = g.createRadialGradient(X, Y, 1, X, Y, lang);
      kegel.addColorStop(0, "rgba(255, 245, 210, 0.22)");
      kegel.addColorStop(1, "rgba(255, 245, 210, 0)");
      g.fillStyle = kegel;
      g.beginPath();
      g.moveTo(X, Y);
      g.arc(X, Y, lang, w - 0.42, w + 0.42);
      g.closePath();
      g.fill();
      g.globalCompositeOperation = "source-over";
    }
  }

  // ---------------------------------------------------------------------------
  // Der Taucher
  // ---------------------------------------------------------------------------
  /*
   * Im Rahmen des Körpers, in Metern: x nach vorne (zum Kopf), y zum
   * Rücken. Er trägt einen schwarzen Anzug mit Haube, die Maske, lange
   * Flossen und das Netz an der Hüfte. Die Beine schlagen wechselnd, solange
   * er schwimmt; an der Oberfläche paddelt er mit den Armen.
   */
  const ANZUG = { anzug: "#2a3347", streifen: "#2fe0ee", flosse: "#2fe0ee", flossenRand: "#0f8f9c", glas: "#d6f7ff", netz: "#d8d2c4" };

  const figurMass = () => Math.max(kam.z * 1.8, 28, view.minD * 0.08);

  function zeichneTaucher(x, y, winkel, { schlag = 0, oben = false, netz = [], farbe = null, alpha = 1, rot = 0 } = {}) {
    const X = bildX(x);
    const Y = bildY(y);
    const fs = figurMass();
    if (X < -fs * 3 || X > view.cssW + fs * 3 || Y < -fs * 3 || Y > view.cssH + fs * 3) return;
    const F = farbe ? { anzug: farbe, streifen: farbe, flosse: farbe, flossenRand: farbe, glas: "#ffffff", netz: farbe } : ANZUG;
    if (!farbe) {
      // Ein heller Hof: Im dunklen Wasser hebt er sich so ab.
      const hof = g.createRadialGradient(X, Y, 1, X, Y, fs * 1.6);
      hof.addColorStop(0, "rgba(190, 245, 255, 0.22)");
      hof.addColorStop(1, "rgba(190, 245, 255, 0)");
      g.fillStyle = hof;
      g.fillRect(X - fs * 1.6, Y - fs * 1.6, fs * 3.2, fs * 3.2);
    }
    g.save();
    g.globalAlpha = alpha;
    g.translate(X, Y);
    g.rotate(-winkel);
    // Mit dem Rücken nach oben, auch wenn er nach links schwimmt.
    g.scale(fs, Math.cos(winkel) < 0 ? fs : -fs);
    g.lineCap = "round";
    g.lineJoin = "round";
    const linie = (a, b, breit, farbeL) => {
      g.strokeStyle = farbeL;
      g.lineWidth = breit;
      g.beginPath();
      g.moveTo(a[0], a[1]);
      g.lineTo(b[0], b[1]);
      g.stroke();
    };
    const hufte = [0.08, 0];
    const schulter = [0.68, 0.02];
    // Zwei Beine im Wechsel, mit Flossen.
    const bein = (phase, dunkel) => {
      const k = Math.sin(phase);
      const knie = [-0.34, 0.05 * k];
      const fuss = [-0.76, 0.17 * k];
      const flossenEnde = [-1.36, 0.17 * k - 0.24 * Math.sin(phase - 0.9)];
      const farbeB = dunkel ? mische(F.anzug, "#000000", 0.3) : F.anzug;
      linie(hufte, knie, 0.17, farbeB);
      linie(knie, fuss, 0.13, farbeB);
      g.fillStyle = dunkel ? F.flossenRand : F.flosse;
      g.beginPath();
      g.moveTo(fuss[0] + 0.05, fuss[1] + 0.06);
      g.quadraticCurveTo((fuss[0] + flossenEnde[0]) / 2, (fuss[1] + flossenEnde[1]) / 2 + 0.1, flossenEnde[0], flossenEnde[1] + 0.07);
      g.lineTo(flossenEnde[0] - 0.02, flossenEnde[1] - 0.07);
      g.quadraticCurveTo((fuss[0] + flossenEnde[0]) / 2, (fuss[1] + flossenEnde[1]) / 2 - 0.05, fuss[0] + 0.05, fuss[1] - 0.06);
      g.closePath();
      g.fill();
    };
    bein(schlag + Math.PI, true);
    // Arme: unter Wasser lang nach vorne gestreckt, an der Oberfläche
    // paddelnd.
    const hand = oben ? [0.55 + Math.sin(state.echt * 4) * 0.12, -0.42] : [1.34, 0.01];
    linie(schulter, hand, 0.09, mische(F.anzug, "#000000", 0.3));
    linie(hufte, schulter, 0.3, F.anzug);
    if (!farbe) {
      g.strokeStyle = F.streifen;
      g.lineWidth = 0.06;
      g.beginPath();
      g.moveTo(hufte[0] + 0.05, 0.1);
      g.lineTo(schulter[0] - 0.05, 0.11);
      g.stroke();
    }
    bein(schlag, false);
    // Das Netz an der Hüfte mit den Perlen darin.
    if (netz.length) {
      g.fillStyle = farbe || "rgba(216, 210, 196, 0.35)";
      g.beginPath();
      g.ellipse(0.22, -0.2, 0.16, 0.12, 0, 0, Math.PI * 2);
      g.fill();
      netz.slice(-6).forEach((w, i) => {
        g.fillStyle = farbe || PERLFARBE[w];
        g.beginPath();
        g.arc(0.14 + (i % 3) * 0.08, -0.17 - Math.floor(i / 3) * 0.07, 0.04, 0, Math.PI * 2);
        g.fill();
      });
    }
    // Der Kopf mit Haube und Maske.
    g.fillStyle = F.anzug;
    g.beginPath();
    g.arc(0.9, 0.03, 0.13, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = F.glas;
    g.beginPath();
    g.ellipse(0.98, -0.03, 0.06, 0.07, 0, 0, Math.PI * 2);
    g.fill();
    linie(schulter, hand, 0.095, F.anzug);
    if (rot > 0.01 && !farbe) {
      g.globalAlpha = alpha * rot * 0.6;
      g.fillStyle = "#ff3b30";
      g.beginPath();
      g.ellipse(0.2, 0, 1.0, 0.3, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // Die Gegner (geist.js): halb durchsichtige Taucher – nur, wer gerade am
  // selben Platz taucht.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const da = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const wx = o.a / 10;
      const nr = Math.floor((wx + ABSTAND / 2) / ABSTAND);
      if (nr !== state.nr || Math.abs(o.da) > 200) return;
      const x = wx - nr * ABSTAND;
      const y = o.b / 10;
      const schnell = Math.hypot(o.da, o.db) > 1.5;
      zeichneTaucher(x, y, (o.c || 0) / 100, { schlag: schnell ? state.echt * 14 + o.a : 0, oben: y > -0.6, farbe: o.farbe, alpha: 0.45 * o.blass });
      da.push({ ...o, sx: bildX(x), sy: bildY(y) - figurMass() * 0.9, weit: "" });
    });
    if (da.length) window.LernappGeist.namen(g, da, { breit: view.cssW, hoch: view.cssH });
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Anzeigen
  // ---------------------------------------------------------------------------
  /*
   * Der Luftring um den Taucher: voll ist ein ganzer Atemzug, er läuft gegen
   * die Uhr leer – türkis, dann gelb, dann rot. Der weisse Strich sagt, wie
   * viel Luft der Weg nach oben von hier kostet. Erreicht der Ring den
   * Strich, ist es höchste Zeit.
   */
  function zeichneLuftring() {
    const t = state.taucher;
    if (!t || state.schritt !== "tauchen" || state.luftring <= 0.01) return;
    const fs = figurMass();
    const X = bildX(t.x);
    const Y = bildY(t.y);
    const r = clamp(fs * 1.75, 44, 96);
    const luft = clamp(t.luft, 0, 1);
    const knapp = luft < state.bedarf + 0.06;
    g.save();
    g.globalAlpha = state.luftring;
    g.lineCap = "butt";
    g.strokeStyle = "rgba(4, 12, 28, 0.4)";
    g.lineWidth = 7;
    g.beginPath();
    g.arc(X, Y, r, 0, Math.PI * 2);
    g.stroke();
    const farbe = luft > 0.5 ? "#4fe3f0" : luft > 0.25 ? "#ffd23f" : "#ff5a4a";
    const puls = knapp && !ruhig() ? 0.6 + 0.4 * Math.sin(state.echt * 12) : 0.85;
    g.strokeStyle = farbe;
    g.globalAlpha = state.luftring * puls;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(X, Y, r, -Math.PI / 2, -Math.PI / 2 + luft * Math.PI * 2);
    g.stroke();
    // Der Strich: so viel kostet der Weg nach oben.
    const w = -Math.PI / 2 + clamp(state.bedarf, 0, 1) * Math.PI * 2;
    g.globalAlpha = state.luftring;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(X + Math.cos(w) * (r - 7), Y + Math.sin(w) * (r - 7));
    g.lineTo(X + Math.cos(w) * (r + 7), Y + Math.sin(w) * (r + 7));
    g.stroke();
    g.restore();
  }

  // Wenig Luft: Der Rand des Bildes wird rot und pocht.
  function zeichneNot() {
    const t = state.taucher;
    if (!t || state.schritt !== "tauchen") return;
    const k = clamp(1 - t.luft / 0.28, 0, 1);
    const rot = Math.max(k * (0.35 + (ruhig() ? 0 : 0.2 * Math.sin(state.echt * (6 + k * 6)))), state.rot * 0.5);
    if (rot <= 0.01) return;
    const X = view.cssW / 2;
    const Y = view.cssH / 2;
    const verlauf = g.createRadialGradient(X, Y, Math.min(X, Y) * 0.55, X, Y, Math.hypot(X, Y));
    verlauf.addColorStop(0, "rgba(140, 0, 20, 0)");
    verlauf.addColorStop(1, `rgba(140, 0, 20, ${rot})`);
    g.fillStyle = verlauf;
    g.fillRect(0, 0, view.cssW, view.cssH);
  }

  // Rechts am Rand: ein Tiefenmesser. Die Marke ist der Taucher, der Strich
  // dort, wo er schwebt (darunter sinkt er von selbst).
  function zeichneTiefenmesser() {
    const t = state.taucher;
    const p = state.platz;
    if (!t || !p || state.phase === "bereit") return;
    flach();
    const x = view.cssW - 22;
    const oben = view.frei + 70;
    const unten = view.cssH - 96;
    if (unten - oben < 80) return;
    const tiefMax = Math.ceil((p.tief + 2) / 10) * 10;
    const yBei = (d) => oben + (unten - oben) * clamp(d / tiefMax, 0, 1);
    g.strokeStyle = "rgba(255, 255, 255, 0.35)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x, oben);
    g.lineTo(x, unten);
    g.stroke();
    g.font = "800 10px system-ui, sans-serif";
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (let d = 0; d <= tiefMax; d += 10) {
      g.fillStyle = "rgba(255, 255, 255, 0.55)";
      g.fillRect(x - 5, yBei(d) - 1, 10, 2);
      g.fillText(`${d}`, x - 8, yBei(d));
    }
    g.fillStyle = "rgba(127, 240, 255, 0.8)";
    g.fillRect(x - 7, yBei(NEUTRAL) - 1, 14, 2);
    if (state.tiefeMax > 0.5) {
      g.fillStyle = "rgba(255, 210, 63, 0.9)";
      g.fillRect(x - 6, yBei(state.tiefeMax) - 1.5, 12, 3);
    }
    const d = Math.max(0, -t.y);
    const Y = yBei(d);
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.moveTo(x - 4, Y);
    g.lineTo(x - 13, Y - 6);
    g.lineTo(x - 13, Y + 6);
    g.closePath();
    g.fill();
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const s of state.schriften) {
      const k = clamp(s.leben / s.max, 0, 1);
      const alter = s.max - s.leben;
      const pop = alter < 0.15 && !ruhig() ? 0.6 + (alter / 0.15) * 0.4 + Math.sin((alter / 0.15) * Math.PI) * 0.25 : 1;
      const gross = Math.round(s.gross * clamp(view.minD / 380, 0.9, 1.5) * pop);
      const t = s.folgt ? state.taucher : null;
      const X0 = t ? bildX(t.x) : bildX(s.x);
      const Y0 = t ? bildY(t.y) - figurMass() * 1.9 : bildY(s.y);
      const x = clamp(X0, gross * s.text.length * 0.3 + 8, view.cssW - gross * s.text.length * 0.3 - 30);
      const y = clamp(Y0 - (1 - k) * 22, view.frei + gross + 4, view.cssH - gross * 3);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(2, 10, 24, 0.75)";
      g.strokeText(s.text, x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, x, y);
    }
    g.globalAlpha = 1;
  }

  // An der Oberfläche vor dem Tauchgang: wie lange der Platz noch wartet.
  function zeichneWarten() {
    const t = state.taucher;
    if (!t || state.phase !== "spiel" || state.schritt !== "oben") return;
    const gross = Math.round(clamp(view.minD * 0.05, 14, 22));
    const x = clamp(bildX(t.x), 90, view.cssW - 90);
    const y = clamp(bildY(t.y) + figurMass() * 2.2, view.frei + 40, view.cssH - 40);
    const text = state.nr === 0 && state.obenRest > OBEN_ZEIT - 3 ? "Halten: dorthin schwimmen" : `Abtauchen · ${Math.ceil(state.obenRest)}`;
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = Math.max(3, gross * 0.22);
    g.lineJoin = "round";
    g.strokeStyle = "rgba(2, 10, 24, 0.8)";
    g.strokeText(text, x, y);
    g.fillStyle = state.obenRest < 3 ? "#ffb347" : "#ffffff";
    g.fillText(text, x, y);
  }

  function pille(text, x, y, gross, grund, schrift) {
    g.font = `900 ${gross}px system-ui, sans-serif`;
    const w = g.measureText(text).width + gross * 1.4;
    const h = gross * 1.7;
    g.fillStyle = grund;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2);
    else g.rect(x, y, w, h);
    g.fill();
    g.fillStyle = schrift;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x + gross * 0.7, y + h / 2 + 1);
    return h;
  }

  // Oben links, unter den Knöpfen: die Perlen, die oben sind; darunter der
  // Platz, was im Netz liegt und die Tiefe.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    flach();
    g.translate(0, view.frei);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    const text = `${state.punkte}`;
    const x = 12;
    let y = 12;
    const w = g.measureText(text).width + gross * 2.2;
    const hoch = gross * 1.6;
    g.fillStyle = "rgba(4, 14, 30, 0.6)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hoch, hoch / 2);
    else g.rect(x, y, w, hoch);
    g.fill();
    const bx = x + gross * 0.85;
    const by = y + hoch / 2;
    const perle = g.createRadialGradient(bx - gross * 0.1, by - gross * 0.1, 1, bx, by, gross * 0.32);
    perle.addColorStop(0, "#ffffff");
    perle.addColorStop(1, "#cfc4e8");
    g.fillStyle = perle;
    g.beginPath();
    g.arc(bx, by, gross * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x + gross * 1.6, by + 1);
    y += hoch + 6;
    const klein = Math.round(gross * 0.6);
    const p = state.platz;
    if (p) y += pille(`Tauchgang ${Math.min(state.nr + 1, TAUCHGAENGE)}/${TAUCHGAENGE} · ${p.art.name}`, x, y, klein, "rgba(4, 14, 30, 0.55)", "#ffffff") + 5;
    const imNetz = state.netz.reduce((s, v) => s + v, 0);
    if (imNetz) y += pille(`Im Netz +${imNetz}`, x, y, klein, "rgba(255, 210, 63, 0.92)", "#3a2400") + 5;
    const t = state.taucher;
    if (t && state.schritt === "tauchen") pille(`${Math.max(0, -t.y).toFixed(1)} m`, x, y, klein, "rgba(4, 14, 30, 0.55)", "#8fe8ff");
  }

  // Unten in der Mitte: vor dem Tauchgang der Platz, danach, was oben
  // ankam.
  function zeichneTv() {
    const tv = state.tv;
    if (!tv) return;
    const ein = clamp(tv.alter / 0.25, 0, 1);
    const aus = clamp((tv.dauer - tv.alter) / 0.3, 0, 1);
    const k = Math.min(ein, aus);
    if (k <= 0) return;
    flach();
    const W = view.cssW;
    const breit = Math.min(W - 24, 420);
    const gross = clamp(view.minD * 0.075, 22, 40);
    const klein = Math.round(clamp(gross * 0.42, 11, 15));
    const zeile1 = klein * 1.55;
    const zeile2 = zeile1 + gross * 1.02;
    const zeile3 = zeile2 + klein * 1.65;
    const hoch = zeile3 + klein * 0.85;
    const x = (W - breit) / 2 - (1 - ein) * 40 * (ruhig() ? 0 : 1);
    const y = view.cssH - 18 - hoch;
    g.globalAlpha = k;
    g.fillStyle = "rgba(3, 12, 26, 0.86)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, breit, hoch, 12);
    else g.rect(x, y, breit, hoch);
    g.fill();
    g.fillStyle = tv.farbe || "#00A5B5";
    g.fillRect(x, y + 10, 5, hoch - 20);
    g.textBaseline = "alphabetic";
    g.textAlign = "left";
    g.fillStyle = "rgba(255, 255, 255, 0.7)";
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.fillText(tv.oben, x + 18, y + zeile1);
    g.fillStyle = "#ffffff";
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.fillText(tv.gross, x + 18, y + zeile2);
    if (tv.rechts) {
      g.textAlign = "right";
      g.font = `900 ${Math.round(gross * 0.5)}px system-ui, sans-serif`;
      g.fillStyle = tv.rechtsFarbe || "#ffffff";
      g.fillText(tv.rechts, x + breit - 16, y + zeile2 - gross * 0.08);
    }
    g.textAlign = "left";
    g.font = `800 ${klein}px system-ui, sans-serif`;
    g.fillStyle = tv.untenFarbe || "rgba(255, 255, 255, 0.85)";
    g.fillText(tv.unten, x + 18, y + zeile3);
    g.globalAlpha = 1;
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    const z = kam.z;
    for (const t of state.teile) {
      const k = clamp(t.leben / t.max, 0, 1);
      const X = bildX(t.x);
      const Y = bildY(t.y);
      if (X < -20 || X > view.cssW + 20 || Y < -20 || Y > view.cssH + 20) continue;
      if (t.art === "blase") {
        g.globalAlpha = Math.min(1, k * 2) * 0.75;
        g.strokeStyle = "#e6fbff";
        g.lineWidth = 1;
        g.beginPath();
        g.arc(X, Y, Math.max(1.2, t.r * z), 0, Math.PI * 2);
        g.stroke();
      } else {
        g.globalAlpha = Math.min(1, k * 1.8);
        g.fillStyle = t.farbe;
        g.beginPath();
        g.arc(X, Y, Math.max(0.8, t.r * z * (0.5 + 0.5 * k)), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g) return;
    kameraSetzen();
    flach();
    g.fillStyle = "#04121c";
    g.fillRect(0, 0, view.cssW, view.cssH);
    zeichneHimmel();
    zeichneWasser();
    zeichneSchwarm();
    zeichneStroemung();
    zeichneGrund();
    zeichneFelsen();
    zeichneMuscheln();
    zeichneBojeUndBoot();
    zeichneQuallen();
    zeichneGeister();
    const t = state.taucher;
    if (t) zeichneTaucher(t.x, t.y, t.winkel, { schlag: t.schlag, oben: t.y > -0.6 && state.schritt !== "blackout", netz: state.netz, rot: state.rot });
    zeichneTeile();
    zeichnePlankton();
    zeichneDunkel();
    zeichneGlanz();
    zeichneOberflaeche();
    zeichneLuftring();
    zeichneNot();
    zeichneSchriften();
    zeichneWarten();
    zeichneTv();
    zeichneAnzeige();
    zeichneTiefenmesser();
    if (state.blende > 0.005) {
      flach();
      g.fillStyle = state.schritt === "blackout" ? `rgba(0, 0, 0, ${state.blende})` : `rgba(2, 8, 18, ${state.blende})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
      if (state.schritt === "blackout" && state.blende > 0.4) {
        g.globalAlpha = clamp((state.blende - 0.4) / 0.4, 0, 1);
        g.font = `900 ${Math.round(clamp(view.minD * 0.1, 26, 48))}px system-ui, sans-serif`;
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = "#ff5a4a";
        g.fillText("Blackout", view.cssW / 2, view.cssH / 2);
        g.globalAlpha = 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 200;

  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  function blasen(x, y, anzahl, streu = 0.3) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      teil({
        art: "blase", x: x + (Math.random() - 0.5) * streu, y: y + (Math.random() - 0.5) * streu,
        vx: (Math.random() - 0.5) * 0.4, vy: 0.9 + Math.random() * 1.4, r: 0.03 + Math.random() * 0.07,
        leben: 1.2 + Math.random() * 1.6, max: 2.8,
      });
    }
  }

  function funken(x, y, anzahl, farbe) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 1 + Math.random() * 2.5;
      teil({ art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.05 + Math.random() * 0.06, farbe, leben: 0.4 + Math.random() * 0.4, max: 0.8 });
    }
  }

  function schrift(text, farbe, gross, dauer = 1.2, { x = 0, y = 0, folgt = true } = {}) {
    state.schriften.push({ text, farbe, gross, x, y, folgt, leben: dauer, max: dauer });
    if (state.schriften.length > 4) state.schriften.shift();
  }

  function tvZeigen(inhalt, dauer) {
    state.tv = { ...inhalt, alter: 0, dauer };
  }

  // Die Karte vor dem Tauchgang: der Platz, wie tief, was dort wartet.
  function karteZeigen(dauer) {
    const p = state.platz;
    if (!p) return;
    const gefahren = [p.stroemung ? "Strömung" : "", p.quallen.length ? "Quallen" : "", p.muraenen.length ? "Muränen" : "", p.art.nacht ? "Nacht" : ""].filter(Boolean);
    tvZeigen({
      oben: `TAUCHGANG ${state.nr + 1} VON ${TAUCHGAENGE}`,
      gross: p.art.name,
      rechts: `bis ${p.tief} m`,
      rechtsFarbe: "#7ff0ff",
      unten: gefahren.length ? gefahren.join(" · ") : "Je tiefer die Perle, desto wertvoller",
      farbe: "#00A5B5",
      karte: true,
    }, dauer);
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  const klang = () => window.ArcadeKlang || null;
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 80) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }

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
  const meer = schleife("freitaucher.meer");
  const herz = schleife("freitaucher.herz");
  function klangAus() {
    meer.aus();
    herz.aus();
  }

  // Jedes Bild: das Meer, tiefer, je tiefer er ist; das Herz, sobald die
  // Luft knapp wird – schneller und lauter, je weniger bleibt.
  function klangTakt() {
    const t = state.taucher;
    const an = t && (state.phase === "spiel" || (state.phase === "zuschauen" && !zuschauer?.fertig?.()));
    const d = t ? Math.max(0, -t.y) : 0;
    if (an && state.schritt !== "wechsel") meer.an(clamp(d / 40, 0, 1), d < 0.6 ? 0.45 : 1);
    else meer.aus();
    if (an && state.phase === "spiel" && state.schritt === "tauchen" && t.luft < 0.6) {
      const k = clamp((0.6 - t.luft) / 0.6, 0, 1);
      herz.an(k, 0.4 + 0.6 * k);
    } else herz.aus();
  }

  // ---------------------------------------------------------------------------
  // Der Tauchgang
  // ---------------------------------------------------------------------------
  function neuerTaucher() {
    return { x: 1.4, y: -0.3, vx: 0, vy: 0, winkel: -0.3, schlag: 0, schlagAnim: 0, schlagRest: 0, luft: 1, betaeubt: 0, stichRuhe: 0 };
  }

  // Ein Platz: für den ersten Tauchgang und jeden weiteren – im Spiel und
  // beim Zuschauen.
  function platzAufbauen(nr) {
    plaetzeBis(nr + 1);
    state.nr = nr;
    state.platz = state.plaetze[nr];
    state.taucher = neuerTaucher();
    state.netz = [];
    state.schritt = "oben";
    state.obenRest = OBEN_ZEIT;
    state.tiefeMax = 0;
    state.teile = [];
    state.bedarf = 0;
    state.luftring = 0;
    state.gewarnt = false;
    for (const m of state.platz.muraenen) { m.raus = 0; m.ruhe = 0; m.zustand = "ruhe"; }
    kam.bereit = false;
  }

  // Wohin er schwimmt: zu den Tasten – oder zum Finger, umgerechnet in die
  // Welt, so wie das Bild gerade steht.
  function richtungJetzt() {
    const t = state.taucher;
    if (state.richtung) return state.richtung;
    const dx = weltX(state.fingerX) - t.x;
    const dy = weltY(state.fingerY) - t.y;
    const l = Math.hypot(dx, dy);
    if (l < 0.25) return { x: Math.cos(t.winkel), y: Math.sin(t.winkel) };
    return { x: dx / l, y: dy / l };
  }

  // Die Strömung in der Höhe y (m/s quer).
  function stroemungBei(y) {
    const s = state.platz?.stroemung;
    if (!s) return 0;
    const u = (y - (s.mitte - s.halb)) / (2 * s.halb);
    if (u <= 0 || u >= 1) return 0;
    const k = Math.sin(Math.PI * u);
    return s.v * k * k;
  }

  // Ein Schritt im Wasser: Flossenschlag, Auftrieb, Strömung, Widerstand,
  // dann Grund und Felsen.
  function bewegen(t, h, dir) {
    const p = state.platz;
    const d = -t.y;
    t.schlagRest -= h;
    t.betaeubt = Math.max(0, t.betaeubt - h);
    t.stichRuhe = Math.max(0, t.stichRuhe - h);
    if (dir && t.schlagRest <= 0 && t.betaeubt <= 0) {
      const samba = state.schritt === "tauchen" && t.luft < SAMBA;
      let dx = dir.x;
      let dy = dir.y;
      if (samba) {
        const w = (Math.random() - 0.5) * 0.9;
        const c = Math.cos(w);
        const s = Math.sin(w);
        [dx, dy] = [dx * c - dy * s, dx * s + dy * c];
      }
      // An der Oberfläche geht es nicht in die Luft.
      if (d < 0.5 && dy > 0) dy = 0;
      const kraft = KICK * (samba ? 0.55 : 1);
      t.vx += dx * kraft;
      t.vy += dy * kraft;
      t.schlagRest = KICK_TAKT;
      t.schlagAnim = 1;
      if (state.schritt === "tauchen") t.luft -= LUFT_KICK;
      if (state.phase === "spiel") {
        ton("freitaucher.flosse", { laut: 0.55 }, 150);
        if (d > 0.6 && Math.random() < 0.5) blasen(t.x - Math.cos(t.winkel) * 1.3, t.y - Math.sin(t.winkel) * 1.3, 2);
      }
    }
    const w = stroemungBei(t.y);
    const rx = t.vx - w;
    const ry = t.vy;
    const v = Math.hypot(rx, ry);
    let ax = -C_WASSER * v * rx;
    let ay = -C_WASSER * v * ry + auftrieb(d);
    if (d < 0.6) ay -= (t.vy * 2.5);
    t.vx += ax * h;
    t.vy += ay * h;
    t.x += t.vx * h;
    t.y += t.vy * h;
    if (t.y > -0.2) { t.y = -0.2; if (t.vy > 0) t.vy = 0; }
    // Der Grund und die Felsen.
    const b = p.boden(t.x);
    if (-t.y > b - R_TAUCHER) {
      t.y = -(b - R_TAUCHER);
      if (t.vy < 0) t.vy *= -0.1;
      t.vx *= 0.985;
    }
    for (const f of p.felsen) {
      const fx = t.x - f.x;
      const fy = t.y - f.y;
      const l = Math.hypot(fx, fy);
      const min = f.r + R_TAUCHER;
      if (l < min && l > 1e-6) {
        const nx = fx / l;
        const ny = fy / l;
        t.x = f.x + nx * min;
        t.y = f.y + ny * min;
        const rein = t.vx * nx + t.vy * ny;
        if (rein < 0) {
          t.vx -= rein * nx * 1.05;
          t.vy -= rein * ny * 1.05;
          // Er gleitet um den Fels herum, nach oben – nie bleibt er unter
          // ihm hängen.
          const tx = ny > 0 ? -ny : ny;
          const ty = Math.abs(nx);
          const seit = t.vx * tx + t.vy * ty;
          if (Math.abs(seit) < 0.6) { t.vx += tx * 0.04 * (nx >= 0 ? 1 : -1) + nx * 0.02; t.vy += ty * 0.04 + 0.02; }
        }
      }
    }
    if (t.x < X_MIN) { t.x = X_MIN; t.vx = Math.max(0, t.vx); }
    if (t.x > X_MAX) { t.x = X_MAX; t.vx = Math.min(0, t.vx); }
    // Der Körper zeigt, wohin er schwimmt – sonst, wohin er treibt.
    const speed = Math.hypot(t.vx, t.vy);
    const ziel = dir ? Math.atan2(dir.y, dir.x) : speed > 0.4 ? Math.atan2(t.vy, t.vx) : (Math.cos(t.winkel) >= 0 ? 0 : Math.PI);
    t.winkel = winkelZu(t.winkel, ziel, dir ? 7 : 2.5, h);
    t.schlagAnim = Math.max(0, t.schlagAnim - h * 2.2);
    t.schlag += h * (1.5 + 15 * t.schlagAnim);
  }

  // Die Hände: dort greift er nach den Muscheln.
  const haende = (t) => ({ x: t.x + Math.cos(t.winkel) * 1.15, y: t.y + Math.sin(t.winkel) * 1.15 });

  // Die Muscheln: Nah am Taucher klappen sie auf; wer sie mit den Händen
  // (oder dem Körper) berührt, nimmt die Perle.
  function muschelnTakt(h, mitWirkung) {
    const t = state.taucher;
    const hand = haende(t);
    for (const m of state.platz.muscheln) {
      const nah = Math.min(Math.hypot(m.x - hand.x, m.y - hand.y), Math.hypot(m.x - t.x, m.y - t.y));
      m.auf = naeher(m.auf || 0, nah < 5 ? 1 : 0, 3, h);
      if (m.leer || nah > GREIF) continue;
      m.leer = true;
      state.netz.push(m.wert);
      if (!mitWirkung) continue;
      schrift(`+${m.wert}`, m.wert >= 5 ? "#ffd23f" : "#ffffff", m.wert >= 5 ? 26 : 20, 1.1);
      funken(m.x, m.y + 0.2, m.wert >= 5 ? 16 : 9, PERLFARBE[m.wert] === "#3a3346" ? "#c7a8ff" : PERLFARBE[m.wert]);
      ton("freitaucher.perle", { laut: m.wert >= 5 ? 1 : 0.8 }, 60);
      kids()?.vibrate?.(m.wert >= 5 ? [10, 30, 14] : 10);
    }
  }

  // Die Quallen stechen: Luft weg, kurz kein Schlag, und ein Stoss weg von
  // ihr.
  function quallenTakt() {
    const t = state.taucher;
    for (const q of state.platz.quallen) {
      const o = quallenOrt(q, state.zeit);
      const dx = t.x - o.x;
      const dy = t.y - (o.y - q.r * 0.8);
      const l = Math.hypot(dx, dy);
      if (l > q.r + R_TAUCHER + 0.35 || t.stichRuhe > 0) continue;
      t.stichRuhe = 1.2;
      t.betaeubt = 0.8;
      t.luft -= 0.1;
      t.vx += (dx / (l || 1)) * 2;
      t.vy += (dy / (l || 1)) * 2;
      state.rot = 1;
      state.stoss = 0.5;
      schrift("Autsch! −Luft", "#ff8fd0", 20, 1.2);
      ton("freitaucher.qualle", { laut: 1 }, 300);
      kids()?.vibrate?.([20, 30, 20]);
    }
  }

  // Die Muränen: Kommt er ihrem Fels zu nah, schiesst sie heraus. Erwischt
  // sie ihn, reisst sie die wertvollste Perle aus dem Netz.
  function muraenenTakt(h) {
    const t = state.taucher;
    for (const m of state.platz.muraenen) {
      m.ruhe = Math.max(0, m.ruhe - h);
      const kopf = { x: m.x + m.seite * m.raus * 2.2, y: m.y };
      if (m.zustand === "ruhe") {
        const nah = Math.hypot(t.x - m.x, t.y - m.y);
        const davor = (t.x - m.x) * m.seite > -0.5;
        if (nah < 2.8 && davor && m.ruhe <= 0) { m.zustand = "raus"; m.biss = false; }
      } else if (m.zustand === "raus") {
        m.raus = Math.min(1, m.raus + h / 0.22);
        if (!m.biss && Math.hypot(t.x - kopf.x, t.y - kopf.y) < 0.85) {
          m.biss = true;
          t.luft -= 0.05;
          state.rot = 1;
          state.stoss = 0.6;
          if (state.netz.length) {
            const i = state.netz.indexOf(Math.max(...state.netz));
            const weg = state.netz.splice(i, 1)[0];
            schrift(`Biss! −${weg}`, "#ff7a6b", 22, 1.3);
          } else schrift("Biss!", "#ff7a6b", 22, 1.1);
          ton("fehler", { laut: 0.7 }, 300);
          kids()?.vibrate?.([30, 30, 30]);
        }
        if (m.raus >= 1) m.zustand = "rein";
      } else {
        m.raus = Math.max(0, m.raus - h / 0.6);
        if (m.raus <= 0) { m.zustand = "ruhe"; m.ruhe = 2.2; }
      }
    }
  }

  // Wie viel Luft der Weg nach oben von hier kostet: geradeaus hinauf, mit
  // Schlägen, bis ihn der Auftrieb trägt, dann gleitend.
  function bedarfJetzt() {
    const t = state.taucher;
    if (!t) return 0;
    const p = { x: t.x, y: t.y, vx: t.vx, vy: t.vy };
    let rest = 0;
    let luft = 0;
    const h = 1 / 60;
    for (let s = 0; s < 40; s += h) {
      const d = -p.y;
      if (d < 0.3) return luft;
      rest -= h;
      if (d > NEUTRAL * 0.55 && rest <= 0) { p.vy += KICK; rest = KICK_TAKT; luft += LUFT_KICK; }
      const v = Math.hypot(p.vx, p.vy);
      p.vx += -C_WASSER * v * p.vx * h;
      p.vy += (-C_WASSER * v * p.vy + auftrieb(d)) * h;
      p.y += p.vy * h;
      luft += LUFT_S * h;
    }
    return luft;
  }

  function blackout() {
    const t = state.taucher;
    t.luft = 0;
    state.schritt = "blackout";
    state.aus = "blackout";
    const weg = state.netz.reduce((s, v) => s + v, 0);
    state.netz = [];
    state.weiterIn = 2.6;
    state.blendeZiel = 0.9;
    schrift(weg ? `Blackout – ${weg} ${weg === 1 ? "Perle" : "Perlen"} verloren` : "Blackout", "#ff5a4a", 22, 2.2);
    ton("fehler", {}, 300);
    kids()?.vibrate?.([40, 60, 80]);
  }

  // Wieder oben: Das Netz wird gezählt.
  function auftauchen() {
    const t = state.taucher;
    const gesichert = state.netz.reduce((s, v) => s + v, 0);
    state.punkte += gesichert;
    state.ergebnisse.push(gesichert);
    state.netz = [];
    shell.setCount(state.punkte);
    state.schritt = "auf";
    state.weiterIn = 2.5;
    blasen(t.x + 0.8, -0.4, 10, 0.8);
    ton("freitaucher.atem", { laut: 1 }, 400);
    if (gesichert) {
      schrift(`+${gesichert}`, "#ffd23f", 28, 1.6);
      kids()?.vibrate?.([10, 40, 10]);
    }
    tvZeigen({
      oben: `TAUCHGANG ${state.nr + 1} · ${state.platz.art.name.toUpperCase()}`,
      gross: gesichert ? `+${gesichert} ${gesichert === 1 ? "Perle" : "Perlen"}` : "Keine Perle",
      rechts: `${Math.round(state.tiefeMax)} m tief`,
      rechtsFarbe: "#7ff0ff",
      unten: `Luft übrig ${Math.max(0, Math.round(t.luft * 100))} %`,
      untenFarbe: t.luft < 0.1 ? "#ffb0a8" : "#9ff5bd",
      farbe: gesichert ? "#ffd23f" : "#00A5B5",
    }, state.weiterIn);
  }

  // Zu lange an der Oberfläche: Der Platz ist ausgelassen.
  function ausgelassen() {
    state.ergebnisse.push(0);
    state.schritt = "auf";
    state.weiterIn = 1.4;
    schrift("Ausgelassen", "#ffb347", 22, 1.3);
  }

  function weiter() {
    if (state.nr + 1 >= TAUCHGAENGE) {
      if (!state.aus) state.aus = "fertig";
      finish();
      return;
    }
    state.schritt = "wechsel";
    state.blendeZiel = 1;
    plaetzeBis(state.nr + 2);
  }

  function naechsterPlatz() {
    platzAufbauen(state.nr + 1);
    state.blendeZiel = 0;
    karteZeigen(OBEN_ZEIT);
    if (state.platz.art.nacht) schrift("Nacht – die Perlen leuchten", "#c7a8ff", 18, 2.2);
  }

  function schrittTakt(h) {
    const t = state.taucher;
    switch (state.schritt) {
      case "oben":
      case "tauchen": {
        const dir = state.halten && t.betaeubt <= 0 ? richtungJetzt() : null;
        bewegen(t, h, dir);
        const d = -t.y;
        if (state.schritt === "oben") {
          if (d > UNTEN_AB) {
            state.schritt = "tauchen";
            if (state.tv?.karte) state.tv.dauer = Math.min(state.tv.dauer, state.tv.alter + 0.4);
          } else {
            state.obenRest -= h;
            if (state.obenRest <= 0) ausgelassen();
          }
          break;
        }
        state.tiefeMax = Math.max(state.tiefeMax, d);
        t.luft -= LUFT_S * h;
        // Zwei Hinweise: einmal je Runde, wenn er zum ersten Mal von selbst
        // sinkt – und einmal je Tauchgang, wenn die Luft gerade noch für
        // den Weg nach oben reicht.
        if (!state.freifallGesagt && d > NEUTRAL + 1 && t.vy < -0.5) {
          state.freifallGesagt = true;
          schrift("Freifall – loslassen, du sinkst", "#7ff0ff", 16, 2.4);
        }
        if (!state.gewarnt && state.bedarf > 0 && t.luft < state.bedarf + 0.08) {
          state.gewarnt = true;
          schrift("Auftauchen!", "#ffb347", 22, 1.6);
        }
        muschelnTakt(h, true);
        quallenTakt();
        muraenenTakt(h);
        if (t.luft <= 0) blackout();
        else if (d < 0.35 && t.vy > -0.6) auftauchen();
        break;
      }
      case "blackout":
        bewegen(t, h, null);
        state.weiterIn -= h;
        if (state.weiterIn <= 0) finish();
        break;
      case "auf":
        bewegen(t, h, null);
        state.weiterIn -= h;
        if (state.weiterIn <= 0) weiter();
        break;
      case "wechsel":
        if (state.blende >= 0.97) naechsterPlatz();
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  let bedarfZaehler = 0;
  function takt(dt) {
    state.echt += dt;
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.5);
    if (state.rot > 0) state.rot = Math.max(0, state.rot - dt * 1.8);
    const t = state.taucher;

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "spiel") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.phase === "spiel"; i += 1) schrittTakt(dt / n);
      bedarfZaehler += 1;
      if (state.schritt === "tauchen" && bedarfZaehler % 3 === 0) state.bedarf = bedarfJetzt();
    } else if (state.phase === "bereit" && t) {
      t.schlag += dt * 1.5;
      t.y = -0.3 + Math.sin(state.echt * 1.4) * 0.05;
    }
    klangTakt();
    state.luftring = clamp((state.luftring || 0) + (state.schritt === "tauchen" && state.phase === "spiel" ? dt * 4 : -dt * 3), 0, 1);
    if (state.schritt !== "blackout") {
      state.blende = clamp(state.blende + Math.sign(state.blendeZiel - state.blende) * dt * 3.2, 0, 1);
      if (Math.abs(state.blende - state.blendeZiel) < 0.02) state.blende = state.blendeZiel;
    } else {
      state.blende = clamp(state.blende + dt * 0.45, 0, state.blendeZiel);
    }
    nebenbei(dt);
    kameraTakt(dt);

    if (state.phase === "spiel" && t) {
      gegner?.takt(state.punkte, {
        a: Math.round((state.nr * ABSTAND + t.x) * 10),
        b: Math.round(t.y * 10),
        c: Math.round(t.winkel * 100),
      });
    }
  }

  function nebenbei(dt) {
    if (state.tv) {
      state.tv.alter += dt;
      if (state.tv.alter > state.tv.dauer) state.tv = null;
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const p = state.teile[i];
      if (p.art === "blase") {
        p.x += Math.sin(state.echt * 5 + i) * 0.25 * dt + p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > -0.1) p.leben = 0;
      } else {
        p.vx *= 1 - 2 * dt;
        p.vy *= 1 - 2 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      p.leben -= dt;
      if (p.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    // Ab und zu steigen Blasen aus seiner Maske.
    const t = state.taucher;
    if (t && -t.y > 0.8 && (state.schritt === "tauchen" || state.phase === "zuschauen") && Math.random() < dt * 0.9) {
      blasen(t.x + Math.cos(t.winkel) * 1.0, t.y + Math.sin(t.winkel) * 1.0 + 0.1, 2, 0.1);
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Eine aufgezeichnete Runde an ihren eigenen Plätzen: Der Zufall hält die
  // Saat, startRun würfelt damit dieselben Plätze, und der Taucher steht Bild
  // für Bild dort, wo er damals war. Was er dabei streift, nimmt er wie im
  // Spiel; was oben ankam, steht genau in der Aufzeichnung.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    zuschauer.los();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const wx = s.a / 10;
    const nr = clamp(Math.floor((wx + ABSTAND / 2) / ABSTAND), 0, TAUCHGAENGE - 1);
    if (nr !== state.nr) {
      platzAufbauen(nr);
      state.blende = 0.8;
      karteZeigen(2.6);
    }
    const t = state.taucher;
    t.x = clamp(wx - nr * ABSTAND, X_MIN, X_MAX);
    t.y = Math.min(-0.2, s.b / 10);
    t.vx = (s.va || 0) / 10;
    t.vy = (s.vb || 0) / 10;
    t.winkel = (s.c || 0) / 100;
    const speed = Math.hypot(t.vx, t.vy);
    t.schlag += dt * (1.5 + 9 * clamp((speed - 0.8) / 2.5, 0, 1));
    const d = -t.y;
    if (state.schritt === "oben" && d > UNTEN_AB) {
      state.schritt = "tauchen";
      if (state.tv?.karte) state.tv.dauer = Math.min(state.tv.dauer, state.tv.alter + 0.4);
    }
    if (state.schritt === "tauchen") {
      state.tiefeMax = Math.max(state.tiefeMax, d);
      muschelnTakt(dt, true);
      if (d < 0.35) state.schritt = "auf";
    }
    for (const m of state.platz.muraenen) {
      if (m.zustand === "raus") { m.raus = Math.min(1, m.raus + dt / 0.22); if (m.raus >= 1) m.zustand = "rein"; }
      else if (m.zustand === "rein") { m.raus = Math.max(0, m.raus - dt / 0.6); if (m.raus <= 0) { m.zustand = "ruhe"; m.ruhe = 2.2; } }
      else if (Math.hypot(t.x - m.x, t.y - m.y) < 2.8 && (m.ruhe -= dt) <= 0) m.zustand = "raus";
    }
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      const dazu = punkte - state.punkte;
      state.punkte = punkte;
      state.netz = [];
      shell.setCount(punkte);
      ton("freitaucher.atem", { laut: 0.9 }, 400);
      schrift(`+${dazu}`, "#ffd23f", 28, 1.6);
      tvZeigen({
        oben: `TAUCHGANG ${nr + 1} · ${state.platz.art.name.toUpperCase()}`,
        gross: `+${dazu} ${dazu === 1 ? "Perle" : "Perlen"}`,
        rechts: `${Math.round(state.tiefeMax)} m tief`, rechtsFarbe: "#7ff0ff",
        unten: "", farbe: "#ffd23f",
      }, 2.4);
    }
    zuschauer.weiter();
  }

  // ---------------------------------------------------------------------------
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    shell.setPhase("play");
    gegner?.los();
    state.obenRest = OBEN_ZEIT;
    karteZeigen(OBEN_ZEIT);
  }

  function druck() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit" && !shell.live) losGehts();
  }

  // Die Finger: Wer hält, schwimmt dorthin, wo der letzte Finger liegt.
  const finger = new Map();
  function haltenNeu() {
    state.halten = finger.size > 0;
    const letzter = [...finger.values()].pop();
    if (letzter && letzter.x !== undefined) {
      state.fingerX = letzter.x;
      state.fingerY = letzter.y;
    }
    state.richtung = letzter?.richtung || null;
  }

  function fingerAuf(id, wert) {
    const neu = !finger.has(id);
    finger.delete(id);
    finger.set(id, wert);
    haltenNeu();
    if (neu) druck();
  }

  function fingerWeg(id) {
    finger.delete(id);
    haltenNeu();
  }

  function alleWeg() {
    finger.clear();
    haltenNeu();
  }

  const imFeld = (event) => {
    const r = (canvas || host).getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  };

  // Für die Prüfskripte und die Vorführung: schwimme(dx, dy) hält in diese
  // Richtung, lass() lässt los, aktion() ist ein Druck.
  function schwimme(dx, dy) {
    const l = Math.hypot(dx, dy) || 1;
    fingerAuf("auto", { richtung: { x: dx / l, y: dy / l } });
  }
  function lass() { fingerWeg("auto"); }
  function aktion() { druck(); }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    stopLoop();
    klangAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.punkte = 0;
    state.plaetze = [];
    state.ergebnisse = [];
    state.aus = "";
    state.freifallGesagt = false;
    state.blende = 0;
    state.blendeZiel = 0;
    state.tv = null;
    state.schriften = [];
    state.stoss = 0;
    state.rot = 0;
    state.zeit = 0;
    state.echt = 0;
    plaetzeBis(2);
    platzAufbauen(0);
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt fd-prompt", "Halten: dorthin schwimmen · Loslassen: gleiten");
    shell.play.append(promptKnoten, buildPlatz());
    alleWeg();
    view.cssW = 0;
    view.cssH = 0;
    messen();
    karteZeigen(1e9);

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(900, 250 + ziel * 8);
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
    klangAus();
    alleWeg();
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const anzahl = state.ergebnisse.length;
    const bester = anzahl ? Math.max(...state.ergebnisse) : 0;
    const grund = state.aus === "blackout" ? `Blackout im ${state.nr + 1}. Tauchgang` : "";
    shell.showResult({
      label: "Deine Perlen",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [`${anzahl} ${anzahl === 1 ? "Tauchgang" : "Tauchgänge"}, bester +${bester}`, grund, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("fd-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Freitaucher",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "freeDive", fassung: "t1", zufall, einheit: "Perlen", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "freeDive", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Finger irgendwo im Bild: Start – und solange er liegt, schwimmt der
  // Taucher dorthin. Mit dem Finger wandert das Ziel. Nur Knöpfe bleiben
  // Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    fingerAuf(event.pointerId, imFeld(event));
  });
  window.addEventListener("pointermove", (event) => {
    if (!finger.has(event.pointerId)) return;
    finger.set(event.pointerId, imFeld(event));
    haltenNeu();
  });
  window.addEventListener("pointerup", (event) => fingerWeg(event.pointerId));
  window.addEventListener("pointercancel", (event) => fingerWeg(event.pointerId));
  window.addEventListener("blur", alleWeg);

  // Die Pfeiltasten (oder WASD) schwimmen in ihre Richtung, auch schräg.
  // Leertaste oder Enter: geradeaus, wohin er gerade schaut.
  const gedrueckt = new Set();
  const TASTEN = {
    ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1],
    KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, 1], KeyS: [0, -1],
  };
  function tastenNeu() {
    let dx = 0;
    let dy = 0;
    for (const k of gedrueckt) {
      const r = TASTEN[k];
      if (r) { dx += r[0]; dy += r[1]; }
    }
    const geradeaus = gedrueckt.has("Space") || gedrueckt.has("Enter");
    if (!dx && !dy && geradeaus) {
      const t = state.taucher;
      dx = Math.cos(t?.winkel || 0);
      dy = Math.sin(t?.winkel || 0);
    }
    if (!dx && !dy) { fingerWeg("taste"); return; }
    const l = Math.hypot(dx, dy);
    fingerAuf("taste", { richtung: { x: dx / l, y: dy / l } });
  }
  const tasteVon = (event) => (TASTEN[event.key] ? event.key : TASTEN[event.code] ? event.code : event.key === " " ? "Space" : event.key === "Enter" ? "Enter" : null);
  document.addEventListener("keydown", (event) => {
    const k = tasteVon(event);
    if (!k) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    gedrueckt.add(k);
    tastenNeu();
  });
  document.addEventListener("keyup", (event) => {
    const k = tasteVon(event);
    if (!k) return;
    gedrueckt.delete(k);
    tastenNeu();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", stopLoop);

  // Für die Prüfskripte und die Vorführung. schwimme(dx, dy) hält in eine
  // Richtung, lass() lässt los; bedarfJetzt() sagt, wie viel Luft der Weg
  // nach oben kostet.
  window.LernappFreitaucher = {
    TAKT, ABSTAND, TAUCHGAENGE, KICK, NEUTRAL, LUFT_S, LUFT_KICK, GREIF, OBEN_ZEIT,
    state, view, kam, takt, zeichnen, weltText, losGehts, aktion, schwimme, lass,
    bedarfJetzt, plaetzeBis, wertBei, auftrieb, haende, quallenOrt, bildX, bildY,
  };
})();
