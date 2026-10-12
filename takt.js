/*
 * takt.js – Taktgefühl.
 * ---------------------------------------------------------------------------
 * Drei Bahnen, und auf ihnen fallen Noten herab. Unten liegt für jede Bahn
 * ein Kreis; wer ihn antippt, wenn eine Note genau darauf liegt, spielt sie.
 * Genau im Takt heisst «Perfekt», knapp daneben «Gut», und wer zu früh, zu
 * spät oder ins Leere tippt, verliert seine Kette.
 *
 * Die Kette ist der Grund, es noch einmal zu versuchen: Je länger sie hält,
 * desto mehr zählt jede Note – zehn hintereinander verdoppeln, zwanzig
 * verdreifachen, dreissig vervierfachen.
 *
 * Eine Runde dauert gut dreissig Sekunden, und das Tempo zieht an: vier
 * Abschnitte, von 96 bis 144 Schlägen in der Minute. Erst eine Note je
 * Schlag, dann Achtel dazwischen, dann Akkorde auf zwei Bahnen.
 *
 * Der Takt ist zu hören: ein dumpfer Schlag auf jedem Viertel, ein leises
 * Ticken auf jedem Achtel, und jede gespielte Note klingt – jede Bahn in
 * ihrem eigenen Ton. Wer den Ton abgeschaltet hat, spielt nach dem Bild:
 * Der Hintergrund pulsiert mit dem Takt.
 *
 * Gerechnet wird in Sekunden ab Beginn der Runde. Läuft der Ton, ist seine
 * Uhr die Uhr des Spiels – sonst die des Browsers.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "rhythm") return;

  const host = document.querySelector("#tk-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier Math.random; im Turnier fallen für alle dieselben
  // Noten auf dieselben Bahnen (zufall.js).
  const zufall = window.LernappZufall?.fuer?.("rhythmTap") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  const BAHNEN = 3;
  // Die vier Abschnitte: ab wann, wie schnell.
  const ABSCHNITTE = [
    { ab: 0, bpm: 96 },
    { ab: 8, bpm: 112 },
    { ab: 16, bpm: 128 },
    { ab: 24, bpm: 144 },
  ];
  const EINZAEHLEN = 4;            // Schläge, bevor die erste Note kommt
  const ENDE = 31.5;               // nach dieser Sekunde kommt keine Note mehr
  const RUNDE_MS = 33000;
  const FALL = 1.45;               // so lange fällt eine Note bis zum Kreis
  const PERFEKT = 0.055;           // so weit daneben ist noch «Perfekt»
  const GUT = 0.115;               // ... und noch «Gut»
  const VERPASST = 0.15;           // danach ist sie vorbei
  const PUNKTE = { perfekt: 3, gut: 1 };

  // Die Farben und Töne der Bahnen (C-Dur-Dreiklang, eine Oktave hoch).
  const FARBEN = ["#ff5ea8", "#ffd23f", "#4fd1ff"];
  const TOENE = [523.25, 659.25, 783.99];

  const HELP = [
    "Taktgefühl. Auf drei Bahnen fallen Noten herab. Tipp den Kreis unten genau dann, wenn eine Note darauf liegt.",
    "Genau im Takt ist Perfekt, knapp daneben Gut. Wer daneben oder ins Leere tippt, verliert seine Kette.",
    "Je länger die Kette, desto mehr zählt jede Note: zehn verdoppeln, zwanzig verdreifachen, dreissig vervierfachen.",
    "Das Tempo zieht an. Am Rechner gehen auch die Tasten A, S und D oder die Pfeiltasten.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.takt", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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

  // Die Schläge der Runde: jeder Viertel- und Achtelschlag mit seiner Zeit.
  // Das Tempo wechselt an den Grenzen der Abschnitte – auf dem nächsten
  // Schlag, nicht mitten im Takt.
  function schlaege() {
    const liste = [];
    let t = 0;
    let n = 0;
    while (t < ENDE + 1) {
      const abschnitt = ABSCHNITTE.reduce((wahl, a) => (t >= a.ab ? a : wahl), ABSCHNITTE[0]);
      const dauer = 60 / abschnitt.bpm;
      liste.push({ t, n, achtel: false, abschnitt: ABSCHNITTE.indexOf(abschnitt), dauer });
      liste.push({ t: t + dauer / 2, n, achtel: true, abschnitt: ABSCHNITTE.indexOf(abschnitt), dauer });
      t += dauer;
      n += 1;
    }
    return liste;
  }

  // Die Noten: aus den Schlägen, je Abschnitt dichter. Nie dreimal dieselbe
  // Bahn hintereinander, nie zwei Noten zu dicht auf einer Bahn.
  function noten(takt) {
    const liste = [];
    const zuletzt = [-10, -10, -10];
    let vorher = -1;
    let gleich = 0;
    const bahnWahl = () => {
      let b = Math.floor(zufall.zahl() * BAHNEN);
      if (b === vorher && gleich >= 1) b = (b + 1 + Math.floor(zufall.zahl() * 2)) % BAHNEN;
      gleich = b === vorher ? gleich + 1 : 0;
      vorher = b;
      return b;
    };
    takt.forEach((s) => {
      if (s.n < EINZAEHLEN || s.t > ENDE) return;
      const a = s.abschnitt;
      const wurf = zufall.zahl();
      let anzahl = 0;
      if (!s.achtel) anzahl = a >= 2 && wurf < [0, 0, 0.2, 0.28][a] ? 2 : 1;
      else if (wurf < [0, 0.3, 0.5, 0.62][a]) anzahl = 1;
      if (!anzahl) return;
      const erste = bahnWahl();
      const bahnen = anzahl === 2 ? [erste, (erste + 1 + Math.floor(zufall.zahl() * 2)) % BAHNEN] : [erste];
      bahnen.forEach((b) => {
        if (s.t - zuletzt[b] < 0.17) return;
        zuletzt[b] = s.t;
        liste.push({ t: s.t, bahn: b, akkord: anzahl === 2, ergebnis: null });
      });
    });
    return liste;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (noch nichts getippt), "spiel", "ende"
  const state = {
    phase: "bereit",
    takt: [],
    noten: [],
    naechste: 0,          // ab hier könnte eine Note noch gespielt werden
    punkte: 0,
    kette: 0,
    langste: 0,
    perfekt: 0,
    gut: 0,
    daneben: 0,
    druck: [0, 0, 0],     // wie hell die Kreise gerade leuchten
    urteile: [],          // { text, bahn, farbe, leben }
    funken: [],
    puls: 0,
    zeit: 0,              // nur für Schmuck
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js): Platz 1 und die eigene Bestmarke laufen mit.
  let gegner = null;

  const view = { dpr: 1, w: 0, h: 0 };

  // Die Uhr der Runde: der Ton, wenn er läuft, sonst der Browser.
  const uhr = { ton: null, start: 0, startMs: 0, geplant: 0 };

  function jetzt() {
    if (state.phase === "bereit") return -1;
    if (uhr.ton) return uhr.ton.currentTime - uhr.start;
    return (performance.now() - uhr.startMs) / 1000;
  }

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Ton
  // ---------------------------------------------------------------------------
  // Eigener Ton, nicht kids.js: Der Takt muss auf die Hundertstelsekunde
  // genau vorausgeplant werden. Ob überhaupt etwas klingt, entscheidet
  // derselbe Schalter wie überall.
  function tonAn() {
    if (kids()?.audioEnabled && !kids().audioEnabled()) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      if (!uhr.ctx) uhr.ctx = new AC();
      if (uhr.ctx.state === "suspended") uhr.ctx.resume().catch(() => {});
      return uhr.ctx;
    } catch { return null; }
  }

  function schlag(ctx, zeit, laut) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(140, zeit);
      osc.frequency.exponentialRampToValueAtTime(48, zeit + 0.12);
      gain.gain.setValueAtTime(0.0001, zeit);
      gain.gain.exponentialRampToValueAtTime(laut, zeit + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(zeit);
      osc.stop(zeit + 0.2);
    } catch { /* ohne diesen Schlag */ }
  }

  function tick(ctx, zeit, laut) {
    try {
      const laenge = Math.floor(ctx.sampleRate * 0.03);
      const puffer = ctx.createBuffer(1, laenge, ctx.sampleRate);
      const daten = puffer.getChannelData(0);
      for (let i = 0; i < laenge; i += 1) daten[i] = (Math.random() * 2 - 1) * (1 - i / laenge);
      const quelle = ctx.createBufferSource();
      quelle.buffer = puffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 6000;
      const gain = ctx.createGain();
      gain.gain.value = laut;
      quelle.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      quelle.start(zeit);
    } catch { /* ohne dieses Ticken */ }
  }

  function klang(bahn, perfekt) {
    const ctx = uhr.ton;
    if (!ctx) return;
    try {
      const zeit = ctx.currentTime + 0.005;
      const f = TOENE[bahn] * (perfekt ? 2 : 1);
      [[f, "triangle", 0.07], [f * 2, "sine", 0.02]].forEach(([freq, typ, laut]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = typ;
        osc.frequency.setValueAtTime(freq, zeit);
        gain.gain.setValueAtTime(0.0001, zeit);
        gain.gain.exponentialRampToValueAtTime(laut, zeit + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, zeit + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(zeit);
        osc.stop(zeit + 0.36);
      });
    } catch { /* ohne Klang */ }
  }

  // Plant den Takt voraus, ein Stück über das nächste Bild hinaus.
  function plane() {
    const ctx = uhr.ton;
    if (!ctx) return;
    const bis = jetzt() + 0.25;
    while (uhr.geplant < state.takt.length && state.takt[uhr.geplant].t <= bis) {
      const s = state.takt[uhr.geplant];
      const zeit = uhr.start + s.t;
      if (zeit >= ctx.currentTime - 0.01) {
        if (s.achtel) tick(ctx, zeit, 0.05);
        else schlag(ctx, zeit, s.n < EINZAEHLEN ? 0.5 : s.n % 4 === 0 ? 0.42 : 0.3);
      }
      uhr.geplant += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "tk-platz");
    feld = shell.el("div", "tk-feld");
    canvas = document.createElement("canvas");
    canvas.className = "tk-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    const tipp = shell.el("span", "tk-tipp");
    tipp.setAttribute("aria-hidden", "true");
    tipp.append(art.el("svg", { viewBox: "0 0 64 64" }, [
      art.el("circle", { class: "tk-tipp-ring", cx: 32, cy: 32, r: 14, fill: "none", stroke: "#ffffff", "stroke-width": 4 }),
      art.el("circle", { class: "tk-tipp-ring is-spaet", cx: 32, cy: 32, r: 14, fill: "none", stroke: "#ffffff", "stroke-width": 4 }),
      art.el("circle", { cx: 32, cy: 32, r: 9, fill: "#ffffff" }),
    ]));
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const w = Math.max(80, feld.clientWidth);
    const h = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    if (w === view.w && h === view.h && dpr === view.dpr) return;
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Die Masse: Bahnen nicht breiter als nötig – auf einem breiten Bild in der
  // Mitte, mit Platz zu beiden Seiten.
  function masse() {
    const W = view.w;
    const H = view.h;
    const bahnW = Math.min(W / BAHNEN, H * 0.3, 150);
    const links = (W - bahnW * BAHNEN) / 2;
    const linie = H * 0.84;
    const oben = H * 0.04;
    const kreisR = Math.min(bahnW * 0.36, H * 0.07);
    return { W, H, bahnW, links, linie, oben, kreisR };
  }

  const bahnMitte = (m, b) => m.links + m.bahnW * (b + 0.5);
  const yBei = (m, dt) => m.linie - (dt / FALL) * (m.linie - m.oben);

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function kreis(x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
    g.fill();
  }

  function zeichneBuehne(m, t) {
    const puls = ruhig() ? 0 : state.puls;
    const hinten = g.createLinearGradient(0, 0, 0, m.H);
    hinten.addColorStop(0, "#1a1033");
    hinten.addColorStop(1, `rgb(${Math.round(48 + puls * 30)}, ${Math.round(26 + puls * 12)}, ${Math.round(88 + puls * 30)})`);
    g.fillStyle = hinten;
    g.fillRect(0, 0, m.W, m.H);

    // Lichtkegel von oben, die mit dem Takt schwenken.
    const schwenk = ruhig() ? 0 : Math.sin(state.zeit * 0.7);
    [0.2, 0.5, 0.8].forEach((x, i) => {
      const fx = m.W * x + schwenk * m.W * 0.1 * (i - 1);
      const kegel = g.createLinearGradient(fx, 0, fx, m.H);
      kegel.addColorStop(0, `rgba(${i === 1 ? "255, 210, 63" : "190, 140, 255"}, ${0.12 + puls * 0.12})`);
      kegel.addColorStop(1, "rgba(190, 140, 255, 0)");
      g.fillStyle = kegel;
      g.beginPath();
      g.moveTo(fx - m.W * 0.03, 0);
      g.lineTo(fx + m.W * 0.03, 0);
      g.lineTo(fx + m.W * 0.18, m.H);
      g.lineTo(fx - m.W * 0.18, m.H);
      g.closePath();
      g.fill();
    });

    // Die Bahnen: dunkle Streifen mit hellen Rändern.
    for (let b = 0; b < BAHNEN; b += 1) {
      const x = m.links + b * m.bahnW;
      g.fillStyle = b % 2 ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.08)";
      g.fillRect(x + 2, m.oben, m.bahnW - 4, m.H - m.oben);
      const leuchten = state.druck[b];
      if (leuchten > 0) {
        const glanz = g.createLinearGradient(0, m.linie, 0, m.oben);
        glanz.addColorStop(0, hexA(FARBEN[b], 0.35 * leuchten));
        glanz.addColorStop(1, hexA(FARBEN[b], 0));
        g.fillStyle = glanz;
        g.fillRect(x + 2, m.oben, m.bahnW - 4, m.linie - m.oben);
      }
    }
    // Taktstriche: auf jedem Viertel eine Linie, die mit den Noten fällt.
    g.strokeStyle = "rgba(255, 255, 255, 0.1)";
    g.lineWidth = 1;
    state.takt.forEach((s) => {
      if (s.achtel) return;
      const dt = s.t - t;
      if (dt < -0.05 || dt > FALL) return;
      const y = yBei(m, dt);
      g.beginPath();
      g.moveTo(m.links, y);
      g.lineTo(m.links + m.bahnW * BAHNEN, y);
      g.stroke();
    });
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  function zeichneKreise(m) {
    for (let b = 0; b < BAHNEN; b += 1) {
      const x = bahnMitte(m, b);
      const d = state.druck[b];
      g.fillStyle = hexA(FARBEN[b], 0.18 + 0.5 * d);
      kreis(x, m.linie, m.kreisR * (1 + 0.12 * d));
      g.strokeStyle = hexA(FARBEN[b], 0.9);
      g.lineWidth = Math.max(2, m.kreisR * 0.12);
      g.beginPath();
      g.arc(x, m.linie, m.kreisR, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function zeichneNoten(m, t) {
    const r = m.kreisR * 0.78;
    for (let i = state.naechste; i < state.noten.length; i += 1) {
      const note = state.noten[i];
      const dt = note.t - t;
      if (dt > FALL + 0.1) break;
      if (note.ergebnis === "perfekt" || note.ergebnis === "gut") continue;
      const y = yBei(m, dt);
      const x = bahnMitte(m, note.bahn);
      const verpasst = note.ergebnis === "verpasst";
      g.globalAlpha = verpasst ? 0.3 : 1;
      // Ein Akkord: ein Band zur Partnernote.
      if (note.akkord && !verpasst) {
        const partner = state.noten.find((n) => n !== note && n.t === note.t && n.bahn > note.bahn);
        if (partner) {
          g.strokeStyle = "rgba(255, 255, 255, 0.45)";
          g.lineWidth = r * 0.35;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(bahnMitte(m, partner.bahn), y);
          g.stroke();
        }
      }
      const schein = g.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8);
      schein.addColorStop(0, hexA(FARBEN[note.bahn], 0.55));
      schein.addColorStop(1, hexA(FARBEN[note.bahn], 0));
      g.fillStyle = schein;
      kreis(x, y, r * 1.8);
      g.fillStyle = FARBEN[note.bahn];
      kreis(x, y, r);
      g.fillStyle = "rgba(255, 255, 255, 0.75)";
      kreis(x - r * 0.28, y - r * 0.28, r * 0.32);
    }
    g.globalAlpha = 1;
  }

  function zeichneFunken() {
    state.funken.forEach((f) => {
      g.globalAlpha = clamp(f.leben / f.max, 0, 1);
      g.fillStyle = f.farbe;
      kreis(f.x, f.y, f.r);
    });
    g.globalAlpha = 1;
  }

  function zeichneUrteile(m) {
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.urteile.forEach((u) => {
      const k = clamp(u.leben / u.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 2.5);
      const gross = clamp(m.bahnW * 0.2, 13, 22) * (u.gross || 1);
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      const y = m.linie - m.kreisR * 1.6 - (1 - k) * 18;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(20, 10, 40, 0.7)";
      g.strokeText(u.text, bahnMitte(m, u.bahn), y);
      g.fillStyle = u.farbe;
      g.fillText(u.text, bahnMitte(m, u.bahn), y);
    });
    g.globalAlpha = 1;
  }

  // Oben: die Kette und ihr Faktor, und der Takt des Abschnitts.
  function zeichneAnzeige(m, t) {
    const gross = clamp(m.H * 0.042, 13, 20);
    g.textBaseline = "middle";
    if (state.kette >= 2) {
      g.textAlign = "center";
      g.font = `900 ${Math.round(gross * 1.2)}px system-ui, sans-serif`;
      const faktor = faktorBei(state.kette);
      g.fillStyle = faktor >= 3 ? "#ffd23f" : "#ffffff";
      g.fillText(`Kette ${state.kette}${faktor > 1 ? ` · ×${faktor}` : ""}`, m.W / 2, m.oben + gross * 1.3);
    }
    const abschnitt = ABSCHNITTE.reduce((wahl, a) => (Math.max(0, t) >= a.ab ? a : wahl), ABSCHNITTE[0]);
    g.textAlign = "right";
    g.font = `800 ${Math.round(gross * 0.85)}px system-ui, sans-serif`;
    g.fillStyle = "rgba(255, 255, 255, 0.7)";
    g.fillText(`♩ ${abschnitt.bpm}`, m.W - 10, m.oben + gross * 1.3);

    // Das Einzählen: drei, zwei, eins, los – auf den Schlägen davor.
    if (state.phase === "spiel" && t < state.takt[EINZAEHLEN]?.t) {
      const schlagNr = state.takt.filter((s) => !s.achtel && s.t <= t).length;
      const worte = ["", "3", "2", "1", "Los!"];
      const wort = worte[clamp(schlagNr, 0, 4)];
      if (wort) {
        g.textAlign = "center";
        g.font = `900 ${Math.round(m.H * 0.12)}px system-ui, sans-serif`;
        g.fillStyle = "rgba(255, 255, 255, 0.9)";
        g.fillText(wort, m.W / 2, m.H * 0.42);
      }
    }
  }

  function zeichnen() {
    if (!g) return;
    const m = masse();
    const t = state.phase === "bereit" ? 0 : jetzt();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.clearRect(0, 0, m.W, m.H);
    zeichneBuehne(m, t);
    zeichneKreise(m);
    zeichneNoten(m, t);
    zeichneFunken();
    zeichneUrteile(m);
    zeichneAnzeige(m, t);
  }

  // ---------------------------------------------------------------------------
  // Spielen
  // ---------------------------------------------------------------------------
  const faktorBei = (kette) => Math.min(4, 1 + Math.floor(kette / 10));

  function urteil(text, bahn, farbe, gross = 1) {
    state.urteile = state.urteile.filter((u) => u.bahn !== bahn);
    state.urteile.push({ text, bahn, farbe, gross, leben: 0.55, max: 0.55 });
  }

  function funken(m, bahn, anzahl) {
    const x = bahnMitte(m, bahn);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 160;
      state.funken.push({ x, y: m.linie, vx: Math.cos(w) * v, vy: Math.sin(w) * v - 60, r: 1.5 + Math.random() * 2.5, leben: 0.45, max: 0.45, farbe: FARBEN[bahn] });
    }
  }

  function kettenBruch() {
    state.kette = 0;
  }

  function tippen(bahn) {
    if (state.phase === "ende") return;
    if (state.phase === "bereit") { losGehts(); return; }
    const t = jetzt();
    state.druck[bahn] = 1;
    const m = masse();
    // Die früheste Note auf dieser Bahn, die noch zu spielen ist.
    let beste = null;
    for (let i = state.naechste; i < state.noten.length; i += 1) {
      const note = state.noten[i];
      if (note.t - t > GUT) break;
      if (note.bahn !== bahn || note.ergebnis) continue;
      if (Math.abs(note.t - t) <= GUT) { beste = note; break; }
    }
    if (!beste) {
      // Ins Leere getippt: kostet die Kette, nicht die Punkte.
      if (t > state.takt[EINZAEHLEN].t - 0.3) {
        state.daneben += 1;
        if (state.kette > 0) urteil("Daneben", bahn, "#c9b8ff", 0.9);
        kettenBruch();
      }
      return;
    }
    const perfekt = Math.abs(beste.t - t) <= PERFEKT;
    beste.ergebnis = perfekt ? "perfekt" : "gut";
    state.kette += 1;
    state.langste = Math.max(state.langste, state.kette);
    if (perfekt) state.perfekt += 1;
    else state.gut += 1;
    const plus = PUNKTE[beste.ergebnis] * faktorBei(state.kette);
    state.punkte += plus;
    shell.setCount(state.punkte);
    gegner?.takt(state.punkte);
    urteil(perfekt ? "Perfekt" : "Gut", bahn, perfekt ? "#ffd23f" : "#ffffff", perfekt ? 1.1 : 0.95);
    funken(m, bahn, perfekt ? 12 : 6);
    klang(bahn, perfekt);
    if (state.kette > 0 && state.kette % 10 === 0 && state.kette <= 30) {
      kids()?.vibrate?.([10, 20, 10]);
      urteil(`×${faktorBei(state.kette)}!`, 1, "#ffd23f", 1.4);
    }
  }

  // Noten, die vorbeigefallen sind, ohne gespielt zu werden.
  function verpasse(t) {
    while (state.naechste < state.noten.length) {
      const note = state.noten[state.naechste];
      if (note.ergebnis) { state.naechste += 1; continue; }
      if (t - note.t <= VERPASST) break;
      note.ergebnis = "verpasst";
      state.daneben += 1;
      if (state.kette > 0) urteil("Verpasst", note.bahn, "#c9b8ff", 0.85);
      kettenBruch();
      state.naechste += 1;
    }
  }

  function losGehts() {
    state.phase = "spiel";
    shell.setPhase("play");
    uhr.ton = tonAn();
    uhr.geplant = 0;
    // Ein kleiner Vorlauf, damit der erste Schlag nicht schon vorbei ist,
    // wenn der Ton anläuft.
    if (uhr.ton) uhr.start = uhr.ton.currentTime + 0.12;
    uhr.startMs = performance.now() + 120;
    shell.startClock(RUNDE_MS, finish);
    gegner?.los();
    kids()?.vibrate?.(8);
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  function schritt(dt) {
    state.zeit += dt;
    const t = jetzt();
    if (state.phase === "spiel") {
      plane();
      verpasse(t);
      // Der Puls: hell auf jedem Viertel, dann abklingend.
      const letzter = state.takt.filter((s) => !s.achtel && s.t <= t).pop();
      state.puls = letzter ? Math.max(0, 1 - (t - letzter.t) / 0.25) : 0;
      if (t > ENDE + 1.2 && state.naechste >= state.noten.length) finish();
    } else {
      state.puls = 0;
    }
    for (let b = 0; b < BAHNEN; b += 1) state.druck[b] = Math.max(0, state.druck[b] - dt * 5);
    for (let i = state.funken.length - 1; i >= 0; i -= 1) {
      const f = state.funken[i];
      f.vy += 300 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.leben -= dt;
      if (f.leben <= 0) state.funken.splice(i, 1);
    }
    for (let i = state.urteile.length - 1; i >= 0; i -= 1) {
      state.urteile[i].leben -= dt;
      if (state.urteile[i].leben <= 0) state.urteile.splice(i, 1);
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    messen();
    schritt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    shell.stopClock();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.takt = schlaege();
    state.noten = noten(state.takt);
    state.naechste = 0;
    state.punkte = 0;
    state.kette = 0;
    state.langste = 0;
    state.perfekt = 0;
    state.gut = 0;
    state.daneben = 0;
    state.druck = [0, 0, 0];
    state.urteile = [];
    state.funken = [];
    state.puls = 0;
    state.zeit = 0;
    uhr.ton = null;
    uhr.geplant = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt tk-prompt", "Tipp den Kreis, wenn die Note darauf liegt.");
    shell.play.append(prompt, buildPlatz());
    view.w = 0;
    view.h = 0;
    messen();

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
    shell.stopClock();
    if (state.phase !== "spiel") return;
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
    const satz = `${state.perfekt} Perfekt · ${state.gut} Gut · längste Kette ${state.langste}`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${satz}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      speech: `${punkte} Punkte. ${state.perfekt} Mal perfekt, ${state.gut} Mal gut, die längste Kette war ${state.langste}.${rekord ? " Das ist dein neuer Rekord!" : ""}`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("tk-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Taktgefühl",
    area: "gedaechtnis",
    accent: "#7C5CE6",
    accentDark: "#5a41b8",
    help: HELP,
    clock: true,
    onRestart: startRun,
  });
  gegner = window.LernappGeist?.fuer?.({ spiel: "rhythmTap", host, art: "tempo" }) || null;

  startRun();

  // Getippt wird auf der Fläche: Welche Bahn, sagt, wo der Finger liegt.
  // Mehrere Finger zugleich gehen – für die Akkorde.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const m = masse();
    const x = event.clientX - box.left;
    const bahn = clamp(Math.floor((x - m.links) / m.bahnW), 0, BAHNEN - 1);
    event.preventDefault();
    tippen(bahn);
  });

  const TASTEN = {
    a: 0, s: 1, d: 2, j: 0, k: 1, l: 2, 1: 0, 2: 1, 3: 2,
    ArrowLeft: 0, ArrowDown: 1, ArrowUp: 1, ArrowRight: 2,
  };
  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    const bahn = TASTEN[event.key] ?? TASTEN[String(event.key).toLowerCase()];
    if (bahn !== undefined) {
      event.preventDefault();
      tippen(bahn);
      return;
    }
    if ((event.key === " " || event.key === "Enter") && state.phase === "bereit") {
      if (document.activeElement?.tagName === "BUTTON") return;
      event.preventDefault();
      tippen(1);
    }
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappTakt = {
    BAHNEN, ABSCHNITTE, EINZAEHLEN, FALL, PERFEKT, GUT, VERPASST,
    state, schlaege, noten, jetzt, tippen, masse,
  };
})();
