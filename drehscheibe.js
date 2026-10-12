/*
 * drehscheibe.js – Drehscheibe.
 * ---------------------------------------------------------------------------
 * In der Mitte dreht sich eine Holzscheibe, unten wartet ein Pfeil. Ein Tipp
 * wirft ihn: Er bleibt in der Scheibe stecken und dreht sich von da an mit.
 * Trifft er einen Pfeil, der schon steckt, prallt er ab – und die Runde ist
 * vorbei. Wer alle Pfeile einer Scheibe untergebracht hat, sprengt sie, und
 * die nächste kommt.
 *
 * Schwerer wird es von Scheibe zu Scheibe: mehr Pfeile, schon steckende im
 * Weg, und vor allem die Drehung. Die erste dreht ruhig, die zweite schneller
 * andersherum, dann pendelt eine, eine ruckt, und jede fünfte ist eine
 * Bossscheibe, die sich nicht entscheiden kann. Danach geht es durchmischt und
 * immer schneller weiter. Wer weit kommt, kommt dorthin, weil er den Rhythmus
 * einer Scheibe liest, bevor er wirft.
 *
 * Gezählt wird jeder steckende Pfeil, jeder getroffene Apfel am Rand zählt
 * zwei, und jede geschaffte Scheibe so viel, wie ihre Nummer sagt.
 *
 * Gezeichnet wird auf eine Leinwand. Die Welt ist SICHT_H Einheiten hoch; im
 * Querformat ist sie breiter, im Hochformat höher – die Scheibe steht immer
 * in der Mitte, der Pfeil immer gleich weit darunter.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "wheel") return;

  const host = document.querySelector("#dr-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Was die Scheiben tun – wie viele Pfeile, welche schon stecken, wo Äpfel
  // hängen, wie sie sich drehen – kommt aus dem Zufall des Turniers: im
  // Turnier für alle dieselben Scheiben. Späne und Splitter würfeln weiter
  // Math.random.
  const zufall = window.LernappZufall?.fuer?.("dartWheel") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const WELT_W = 300;
  const WELT_W_MAX = 640;
  const SICHT_H = 300;
  const R = 66;                    // Halbmesser der Scheibe
  const MITTE_Y = 196;             // Mitte der Scheibe über dem unteren Rand
  const ABSTAND = 182;             // so weit unter der Mitte wartet der Pfeil
  const PFEIL_L = 48;              // Länge eines Pfeils
  const STECK = 12;                // so tief steckt er im Holz
  const FLUG_V = 1700;             // Einheiten je Sekunde
  const NACHLADE_MS = 90;          // bis der nächste Pfeil bereitliegt

  // Zwei Pfeile, die sich näher kommen als das, berühren sich: Die Federn
  // sind breiter als der Schaft.
  const KOLL = 0.15;
  const APFEL_TREFF = 0.22;

  const PLATZEN_MS = 760;          // die Scheibe zerspringt, die nächste kommt
  const ENDE_MS = 1100;

  const PFEIL_FARBEN = ["#ff7a59", "#ffd166", "#7bdff2", "#c19bff", "#8ee59a"];

  const HELP = [
    "Drehscheibe. In der Mitte dreht sich eine Holzscheibe, unten wartet ein Pfeil.",
    "Tippe, dann fliegt er in die Scheibe und bleibt stecken.",
    "Er darf keinen Pfeil treffen, der schon steckt – sonst prallt er ab, und die Runde ist vorbei.",
    "Wenn alle Pfeile einer Scheibe stecken, zerspringt sie, und die nächste kommt.",
    "Triffst du einen Apfel am Rand, gibt es zwei Punkte dazu.",
    "Jede Scheibe dreht sich anders – schau erst zu, dann wirf.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.drehscheibe", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const TAU = Math.PI * 2;
  const norm = (w) => ((w % TAU) + TAU) % TAU;
  // Der kürzere Weg zwischen zwei Winkeln.
  const abstand = (a, b) => {
    const d = Math.abs(norm(a) - norm(b));
    return Math.min(d, TAU - d);
  };

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Die Scheiben
  // ---------------------------------------------------------------------------
  // Wie sich eine Scheibe dreht, in Bogenmass je Sekunde, abhängig von der
  // Zeit seit ihrem Auftauchen. Jede Art ist ein anderer Rhythmus, den man
  // lesen muss.
  const DREHUNG = {
    gleich: (t, s) => s.tempo * s.richtung,
    pendel: (t, s) => s.tempo * 1.6 * Math.sin(t * s.f + s.ph),
    ruck: (t, s) => s.richtung * s.tempo * (0.25 + 1.7 * Math.pow(Math.max(0, Math.sin(t * s.f + s.ph)), 3)),
    wechsel: (t, s) => s.richtung * s.tempo * Math.tanh(3.2 * Math.sin(t * s.f + s.ph)),
    boss: (t, s) => s.richtung * s.tempo * (0.7 + 0.9 * Math.sin(t * s.f + s.ph) + 0.6 * Math.sin(t * s.f * 2.3 + s.ph * 1.7)),
  };

  // Die Scheibe Nummer n (null ist die erste).
  function neueScheibe(n) {
    const boss = n % 5 === 4;
    let art = ["gleich", "gleich", "pendel", "ruck", "boss"][n] || null;
    if (!art) art = boss ? "boss" : ["gleich", "pendel", "ruck", "wechsel"][Math.floor(zufall.zahl() * 4)];
    const richtung = n === 1 ? -1 : (zufall.zahl() < 0.5 ? -1 : 1);
    const tempo = Math.min(4.3, 1.7 * Math.pow(1.09, n)) * (n === 1 ? 1.25 : 1);
    const scheibe = {
      n,
      art,
      boss,
      tempo,
      richtung,
      f: 0.9 + zufall.zahl() * 0.9,
      ph: zufall.zahl() * TAU,
      pfeile: boss ? 7 + Math.min(3, Math.floor(n / 5)) : Math.min(10, 5 + Math.floor((n + 1) / 2)),
      stecken: [],
      aepfel: [],
      farbe: PFEIL_FARBEN[n % PFEIL_FARBEN.length],
    };
    // Was schon steckt: erst einer, dann mehr. Nie zu dicht beieinander –
    // eine Lücke, durch die kein Pfeil passt, wäre kein Spiel.
    const vorher = n === 0 ? 0 : Math.min(4, 1 + Math.floor(n / 2) + (boss ? 1 : 0));
    const frei = (w, mindest) => scheibe.stecken.every((p) => abstand(p.w, w) >= mindest)
      && scheibe.aepfel.every((a) => abstand(a.w, w) >= mindest);
    for (let i = 0; i < vorher; i += 1) {
      for (let versuch = 0; versuch < 20; versuch += 1) {
        const w = zufall.zahl() * TAU;
        if (frei(w, 0.6)) { scheibe.stecken.push({ w, alt: true, stoss: 0 }); break; }
      }
    }
    const aepfel = n === 0 ? 1 : (zufall.zahl() < 0.45 ? 2 : 1);
    for (let i = 0; i < aepfel; i += 1) {
      for (let versuch = 0; versuch < 20; versuch += 1) {
        const w = zufall.zahl() * TAU;
        if (frei(w, 0.45)) { scheibe.aepfel.push({ w, weg: false }); break; }
      }
    }
    return scheibe;
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch kein Wurf), "spiel", "ende"
  // schritt: "zielen" (ein Pfeil liegt bereit), "flug", "platzen", "aus"
  const state = {
    phase: "bereit",
    schritt: "zielen",
    punkte: 0,
    scheibe: null,
    winkel: 0,
    t: 0,                 // Zeit seit Auftauchen der Scheibe
    uebrig: 0,            // Pfeile, die noch geworfen werden müssen
    flug: null,           // { y }
    nachladen: 0,
    ruck: 0,              // die Scheibe zuckt nach einem Treffer
    auf: 1,               // 0 → 1, wenn eine neue Scheibe erscheint
    stuecke: [],          // Splitter der zersprungenen Scheibe
    fliegende: [],        // abgeprallte Pfeile, Apfelhälften, fallende Pfeile
    spaene: [],
    schriften: [],
    blitz: 0,
    stoss: 0,
    zeit: 0,
    platzenZeit: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js): Platz 1 und die eigene Bestmarke als Zielmarke.
  let gegner = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: WELT_W, h: SICHT_H };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "dr-platz");
    feld = shell.el("div", "dr-feld");
    canvas = document.createElement("canvas");
    canvas.className = "dr-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    const tipp = shell.el("span", "dr-tipp");
    tipp.setAttribute("aria-hidden", "true");
    tipp.append(art.el("svg", { viewBox: "0 0 64 64" }, [
      art.el("circle", { class: "dr-tipp-ring", cx: 32, cy: 32, r: 14, fill: "none", stroke: "#ffffff", "stroke-width": 4 }),
      art.el("circle", { class: "dr-tipp-ring is-spaet", cx: 32, cy: 32, r: 14, fill: "none", stroke: "#ffffff", "stroke-width": 4 }),
      art.el("circle", { cx: 32, cy: 32, r: 9, fill: "#ffffff" }),
    ]));
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
    view.w = clamp(SICHT_H * (cssW / cssH), WELT_W, WELT_W_MAX);
    view.s = cssW / view.w;
    view.h = cssH / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Ist das Bild höher als SICHT_H, steht alles in der Mitte – darüber und
  // darunter gleich viel Luft.
  const mitteY = () => MITTE_Y + (view.h - SICHT_H) / 2;
  const ruheY = () => mitteY() - ABSTAND;

  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 80) * 3 * state.stoss);

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, wackel() * view.dpr, 0);
  }

  // Welt: x von der Bildmitte, y vom unteren Rand nach oben.
  function weltTransform() {
    const f = view.s * view.dpr;
    g.setTransform(f, 0, 0, -f, (view.cssW / 2 + wackel()) * view.dpr, view.cssH * view.dpr);
  }

  const bildX = (x) => view.cssW / 2 + x * view.s;
  const bildY = (y) => view.cssH - y * view.s;

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function zeichneGrund() {
    bildTransform();
    const cx = view.cssW / 2;
    const cy = bildY(mitteY());
    const r = Math.max(view.cssW, view.cssH);
    const licht = g.createRadialGradient(cx, cy, R * view.s * 0.6, cx, cy, r * 0.75);
    licht.addColorStop(0, "#2f7f8c");
    licht.addColorStop(0.45, "#16495a");
    licht.addColorStop(1, "#0a2230");
    g.fillStyle = licht;
    g.fillRect(-10, -10, view.cssW + 20, view.cssH + 20);

    // Staub im Licht, langsam treibend.
    g.fillStyle = "#ffffff";
    for (let i = 0; i < 26; i += 1) {
      const treib = ruhig() ? 0 : state.zeit * (0.01 + hash01(i * 3.3) * 0.02);
      const x = ((hash01(i * 1.7) + treib) % 1) * view.cssW;
      const y = ((hash01(i * 7.1) + treib * 0.4) % 1) * view.cssH;
      g.globalAlpha = 0.08 + 0.12 * hash01(i * 9.9);
      g.beginPath();
      g.arc(x, y, (0.8 + hash01(i * 4.2) * 1.6) * view.s, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Ein Pfeil, ausgerichtet entlang +y: die Spitze bei 0, die Federn am Ende.
  function zeichnePfeil(farbe, alpha = 1) {
    g.globalAlpha = alpha;
    // Spitze
    g.fillStyle = "#d9dee6";
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(2.3, 7);
    g.lineTo(-2.3, 7);
    g.closePath();
    g.fill();
    // Schaft
    g.fillStyle = "#3a4250";
    g.fillRect(-1.3, 7, 2.6, 15);
    // Griff
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(-2.8, 21);
    g.lineTo(2.8, 21);
    g.lineTo(2.2, 34);
    g.lineTo(-2.2, 34);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.45)";
    g.fillRect(-2.2, 22, 1.2, 11);
    // Federn
    g.fillStyle = farbe;
    g.beginPath();
    g.moveTo(-1.4, 33);
    g.lineTo(-6.4, 46);
    g.lineTo(-1.4, PFEIL_L);
    g.closePath();
    g.moveTo(1.4, 33);
    g.lineTo(6.4, 46);
    g.lineTo(1.4, PFEIL_L);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(0, 0, 0, 0.18)";
    g.beginPath();
    g.moveTo(1.4, 33);
    g.lineTo(6.4, 46);
    g.lineTo(1.4, PFEIL_L);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }

  function zeichneApfel(halb = 0) {
    g.fillStyle = "#e5383b";
    g.beginPath();
    if (halb) g.arc(0, 0, 8.5, halb > 0 ? -Math.PI / 2 : Math.PI / 2, halb > 0 ? Math.PI / 2 : Math.PI * 1.5);
    else g.arc(0, 0, 8.5, 0, TAU);
    g.fill();
    if (halb) {
      g.fillStyle = "#fff4d6";
      g.fillRect(halb > 0 ? 0 : -1.6, -7, 1.6, 14);
      return;
    }
    g.fillStyle = "rgba(255, 255, 255, 0.5)";
    g.beginPath();
    g.arc(-3, 3, 2.4, 0, TAU);
    g.fill();
    g.strokeStyle = "#5b3a1e";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, 7);
    g.lineTo(0.6, 11);
    g.stroke();
    g.fillStyle = "#5fb87a";
    g.beginPath();
    g.ellipse(3.2, 10.4, 3, 1.5, 0.5, 0, TAU);
    g.fill();
  }

  function zeichneScheibe() {
    const sch = state.scheibe;
    if (!sch || state.schritt === "platzen") return;
    const my = mitteY() + state.ruck * 4;
    // Eine neue Scheibe springt auf: aus dem Nichts, ein Stück zu gross, dann
    // ruhig.
    const gross = state.auf < 1 ? 1 - Math.pow(1 - state.auf, 3) + Math.sin(state.auf * Math.PI) * 0.12 : 1;
    const r = R;
    g.save();
    g.translate(0, my);
    g.scale(gross, gross);

    // Schatten
    g.fillStyle = "rgba(0, 0, 0, 0.28)";
    g.beginPath();
    g.arc(3, -5, r + 2, 0, TAU);
    g.fill();

    g.save();
    g.rotate(state.winkel);
    // Erst die steckenden Pfeile: Sie liegen unter dem Holzrand.
    sch.stecken.forEach((p) => {
      g.save();
      g.rotate(p.w);
      g.translate(0, r - STECK + (p.stoss || 0) * 3);
      zeichnePfeil(p.alt ? "#b8c0cc" : sch.farbe);
      g.restore();
    });
    // Rinde
    g.fillStyle = sch.boss ? "#3e2a1a" : "#5b3a1e";
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fill();
    // Holz mit Jahresringen
    const holz = g.createRadialGradient(0, 0, 4, 0, 0, r - 5);
    holz.addColorStop(0, sch.boss ? "#e9a27a" : "#f0c48a");
    holz.addColorStop(1, sch.boss ? "#b45f3c" : "#cf9354");
    g.fillStyle = holz;
    g.beginPath();
    g.arc(0, 0, r - 5, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(110, 62, 26, 0.32)";
    g.lineWidth = 1.4;
    for (let i = 1; i <= 4; i += 1) {
      g.beginPath();
      g.arc(1.5 * Math.sin(i), 1.2 * Math.cos(i * 2), (r - 5) * (i / 5), 0, TAU);
      g.stroke();
    }
    // Risse und ein Ast: daran sieht man, dass sie sich dreht.
    g.strokeStyle = "rgba(90, 50, 20, 0.5)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(r * 0.12, r * 0.1);
    g.lineTo(r * 0.5, r * 0.32);
    g.lineTo(r * 0.78, r * 0.3);
    g.moveTo(-r * 0.2, -r * 0.08);
    g.lineTo(-r * 0.62, -r * 0.4);
    g.stroke();
    g.fillStyle = "rgba(90, 50, 20, 0.55)";
    g.beginPath();
    g.ellipse(-r * 0.35, r * 0.45, 5, 3.4, 0.6, 0, TAU);
    g.fill();
    g.fillStyle = "#7a4a22";
    g.beginPath();
    g.arc(0, 0, 4, 0, TAU);
    g.fill();
    // Äpfel sitzen aussen auf der Rinde.
    sch.aepfel.forEach((a) => {
      if (a.weg) return;
      g.save();
      g.rotate(a.w);
      g.translate(0, r + 7.5);
      g.rotate(Math.PI);
      zeichneApfel();
      g.restore();
    });
    g.restore();
    g.restore();
  }

  function zeichneWartenden() {
    if (state.phase === "ende" || state.schritt === "aus") return;
    const sch = state.scheibe;
    const farbe = sch?.farbe || PFEIL_FARBEN[0];
    if (state.flug) {
      g.save();
      g.translate(0, state.flug.y + PFEIL_L);
      g.rotate(Math.PI);
      zeichnePfeil(farbe);
      g.restore();
      return;
    }
    if (state.schritt !== "zielen" || state.uebrig <= 0) return;
    const rein = clamp(1 - state.nachladen / NACHLADE_MS, 0, 1);
    g.save();
    g.translate(0, ruheY() - (1 - rein) * 18 + PFEIL_L);
    g.rotate(Math.PI);
    zeichnePfeil(farbe, rein);
    g.restore();
  }

  function zeichneFliegende() {
    state.stuecke.forEach((s) => {
      g.save();
      g.translate(s.x, s.y);
      g.rotate(s.dreh);
      g.fillStyle = s.farbe;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, s.r, s.a1, s.a2);
      g.closePath();
      g.fill();
      g.restore();
    });
    state.fliegende.forEach((f) => {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.dreh);
      if (f.art === "pfeil") { g.translate(0, -PFEIL_L / 2); zeichnePfeil(f.farbe); }
      else zeichneApfel(f.halb);
      g.restore();
    });
    state.spaene.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      g.globalAlpha = k;
      g.fillStyle = s.farbe;
      g.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r * 0.6);
    });
    g.globalAlpha = 1;
  }

  // Oben links: welche Scheibe, und fünf Punkte für den laufenden
  // Fünferblock – der fünfte ist der Boss. In der Ecke, nicht über der
  // Scheibe: Dort ragen die Pfeile hin. Unten links neben dem Wurfplatz: die
  // Pfeile, die noch geworfen werden wollen.
  function zeichneAnzeige() {
    bildTransform();
    const sch = state.scheibe;
    if (!sch) return;
    const u = view.s;
    const mitte = view.cssW / 2;
    const ecke = 18 * u;
    const block = Math.floor(sch.n / 5) * 5;
    for (let i = 0; i < 5; i += 1) {
      const n = block + i;
      const boss = i === 4;
      g.beginPath();
      g.arc(ecke + i * 14 * u, ecke, (boss ? 5.2 : 4) * u, 0, TAU);
      g.fillStyle = n < sch.n ? "#ffd166" : n === sch.n ? (boss ? "#ff5d5d" : "#ffffff") : "rgba(255, 255, 255, 0.25)";
      g.fill();
    }
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.font = `800 ${Math.round(10 * u)}px system-ui, sans-serif`;
    g.fillStyle = sch.boss ? "#ffb4a8" : "rgba(255, 255, 255, 0.85)";
    g.fillText(sch.boss ? `Boss · Scheibe ${sch.n + 1}` : `Scheibe ${sch.n + 1}`, ecke - 4 * u, ecke + 15 * u);
    g.textAlign = "center";

    // Die übrigen Pfeile als kleine Striche, unten links neben dem Wurfplatz.
    const links = mitte - 56 * u;
    const unten = bildY(ruheY()) - 2 * u;
    for (let i = 0; i < sch.pfeile; i += 1) {
      const da = i < state.uebrig;
      g.fillStyle = da ? sch.farbe : "rgba(255, 255, 255, 0.2)";
      const y = unten - i * 8.5 * u;
      g.fillRect(links - 7 * u, y - 2 * u, 14 * u, 3.4 * u);
    }

    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross * u)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(10, 30, 40, 0.6)";
      const y = bildY(s.y) - (1 - k) * 22 * u;
      g.strokeText(s.text, bildX(s.x), y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, bildX(s.x), y);
    });
    g.globalAlpha = 1;

    if (state.blitz > 0) {
      g.fillStyle = `rgba(255, 70, 70, ${0.28 * state.blitz})`;
      g.fillRect(-10, -10, view.cssW + 20, view.cssH + 20);
    }
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneGrund();
    weltTransform();
    zeichneScheibe();
    zeichneWartenden();
    zeichneFliegende();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Werfen und Treffen
  // ---------------------------------------------------------------------------
  function werfen() {
    if (state.phase === "bereit") {
      state.phase = "spiel";
      shell.setPhase("play");
      gegner?.los();
    }
    if (state.phase !== "spiel" || state.schritt !== "zielen" || state.auf < 0.85) return;
    if (state.flug || state.uebrig <= 0 || state.nachladen > NACHLADE_MS * 0.4) return;
    state.flug = { y: ruheY() };
    kids()?.vibrate?.(6);
  }

  function spaene(x, y, anzahl, farbe) {
    for (let i = 0; i < anzahl; i += 1) {
      const w = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 40 + Math.random() * 120;
      state.spaene.push({
        x, y,
        vx: Math.cos(w) * v,
        vy: Math.sin(w) * v,
        r: 2 + Math.random() * 2.5,
        leben: 0.45 + Math.random() * 0.3,
        max: 0.75,
        farbe,
      });
    }
  }

  function schrift(text, x, y, farbe, gross) {
    state.schriften.push({ text, x, y, farbe, gross, leben: 0.95, max: 0.95 });
  }

  // Die Spitze ist am Holz angekommen.
  function einschlag() {
    const sch = state.scheibe;
    state.flug = null;
    // Ein steckender Pfeil liegt in der Scheibe unter dem Winkel w: gedreht um
    // winkel + w zeigt er von der Mitte nach aussen. Unten ist das π.
    const w = norm(Math.PI - state.winkel);
    const unten = mitteY() - R;
    const getroffen = sch.stecken.find((p) => abstand(p.w, w) < KOLL);
    if (getroffen) {
      abgeprallt();
      return;
    }
    sch.stecken.push({ w, alt: false, stoss: 1 });
    state.uebrig -= 1;
    state.punkte += 1;
    state.ruck = 1;
    state.nachladen = NACHLADE_MS;
    spaene(0, unten, 8, "#c98f4f");
    kids()?.vibrate?.(10);

    const apfel = sch.aepfel.find((a) => !a.weg && abstand(a.w, w) < APFEL_TREFF);
    if (apfel) {
      apfel.weg = true;
      state.punkte += 2;
      const ax = 0;
      const ay = unten - 8;
      [-1, 1].forEach((seite) => state.fliegende.push({
        art: "apfel", halb: seite, x: ax + seite * 3, y: ay,
        vx: seite * (50 + Math.random() * 30), vy: -20 - Math.random() * 30, dreh: 0, vdreh: seite * 6,
      }));
      spaene(ax, ay, 8, "#ff8f8f");
      schrift("+2", ax + 30, ay - 6, "#ffd166", 15);
      kids()?.playJingle?.("correct");
    } else {
      kids()?.playJingle?.("star");
    }
    shell.setCount(state.punkte);
    gegner?.takt(state.punkte);

    if (state.uebrig <= 0) zerspringen();
  }

  function abgeprallt() {
    state.schritt = "aus";
    state.stoss = 1;
    state.blitz = 1;
    const y = mitteY() - R - 6;
    state.fliegende.push({
      art: "pfeil", farbe: state.scheibe.farbe, x: 0, y: y - PFEIL_L / 2,
      vx: (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 40), vy: -60, dreh: Math.PI, vdreh: 9,
    });
    spaene(0, y + 4, 10, "#d9dee6");
    kids()?.playJingle?.("retry");
    kids()?.vibrate?.([30, 40, 40]);
    stepTimer = window.setTimeout(finish, ENDE_MS);
  }

  // Alle Pfeile stecken: Die Scheibe zerspringt in Keile, die Pfeile fallen
  // heraus, und nach einem Atemzug kommt die nächste.
  function zerspringen() {
    const sch = state.scheibe;
    const bonus = sch.n + 1;
    state.punkte += bonus;
    shell.setCount(state.punkte);
    gegner?.takt(state.punkte);
    state.schritt = "platzen";
    state.platzenZeit = 0;
    state.stoss = 0.7;
    const my = mitteY();
    const keile = 8;
    for (let i = 0; i < keile; i += 1) {
      const a1 = (i / keile) * TAU + state.winkel;
      const a2 = ((i + 1) / keile) * TAU + state.winkel;
      const am = (a1 + a2) / 2;
      state.stuecke.push({
        x: 0, y: my, r: R - 2, a1, a2, dreh: 0,
        vx: Math.cos(am) * (90 + Math.random() * 60),
        vy: Math.sin(am) * (90 + Math.random() * 60) + 60,
        vdreh: (Math.random() - 0.5) * 6,
        farbe: i % 2 ? "#e2ad6c" : "#cf9354",
      });
    }
    sch.stecken.forEach((p) => {
      // Die Richtung nach aussen, in der der Pfeil steckte.
      const w = p.w + state.winkel;
      const ax = -Math.sin(w);
      const ay = Math.cos(w);
      const r = R - STECK + PFEIL_L / 2;
      state.fliegende.push({
        art: "pfeil", farbe: p.alt ? "#b8c0cc" : sch.farbe,
        x: ax * r, y: my + ay * r,
        vx: ax * 90, vy: ay * 90 + 80,
        dreh: w, vdreh: (Math.random() - 0.5) * 8,
      });
    });
    spaene(0, my, 18, "#e2ad6c");
    schrift(`Scheibe ${sch.n + 1} +${bonus}`, 0, my + 6, "#ffffff", 17);
    kids()?.playJingle?.(sch.boss ? "unlock" : "correct");
    kids()?.vibrate?.(30);
  }

  function naechsteScheibe() {
    const n = state.scheibe ? state.scheibe.n + 1 : 0;
    state.scheibe = neueScheibe(n);
    state.uebrig = state.scheibe.pfeile;
    state.winkel = 0;
    state.t = 0;
    state.auf = 0;
    state.schritt = "zielen";
    state.nachladen = NACHLADE_MS;
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  function schritt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 4);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 2.5);
    if (state.ruck > 0) state.ruck = Math.max(0, state.ruck - dt * 9);
    if (state.auf < 1) state.auf = Math.min(1, state.auf + dt * 3.4);
    if (state.nachladen > 0) state.nachladen = Math.max(0, state.nachladen - dt * 1000);

    const sch = state.scheibe;
    if (sch && state.schritt !== "platzen") {
      // Erst wenn die Scheibe ganz da ist, dreht sie – und hält an, sobald
      // ein Pfeil abgeprallt ist.
      if (state.auf >= 1 && state.schritt !== "aus") {
        state.t += dt;
        state.winkel += DREHUNG[sch.art](state.t, sch) * dt;
      }
      sch.stecken.forEach((p) => { if (p.stoss > 0) p.stoss = Math.max(0, p.stoss - dt * 8); });
    }

    if (state.flug) {
      state.flug.y += FLUG_V * dt;
      // flug.y ist das Ende mit den Federn; die Spitze steckt STECK tief im Holz.
      if (state.flug.y + PFEIL_L >= mitteY() - R + STECK) einschlag();
    }

    if (state.schritt === "platzen") {
      state.platzenZeit += dt * 1000;
      if (state.platzenZeit >= PLATZEN_MS) naechsteScheibe();
    }

    const schwer = 520;
    state.stuecke.forEach((s) => {
      s.vy -= schwer * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.dreh += s.vdreh * dt;
    });
    state.stuecke = state.stuecke.filter((s) => s.y > -80);
    state.fliegende.forEach((f) => {
      f.vy -= schwer * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.dreh += f.vdreh * dt;
    });
    state.fliegende = state.fliegende.filter((f) => f.y > -80);
    for (let i = state.spaene.length - 1; i >= 0; i -= 1) {
      const s = state.spaene[i];
      s.vy -= 300 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.leben -= dt;
      if (s.leben <= 0) state.spaene.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    messen();
    // Kleine Schritte: Der Pfeil fliegt schnell, und bei einem langen Bild
    // flöge er sonst durch die Scheibe hindurch, bevor er sie berührt.
    const teile = Math.max(1, Math.ceil(dt / 0.008));
    for (let i = 0; i < teile; i += 1) schritt(dt / teile);
    zeichnen();
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
    state.punkte = 0;
    state.scheibe = null;
    state.flug = null;
    state.stuecke = [];
    state.fliegende = [];
    state.spaene = [];
    state.schriften = [];
    state.stoss = 0;
    state.blitz = 0;
    state.ruck = 0;
    state.zeit = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt dr-prompt", "Tippe – der Pfeil fliegt. Triff keinen anderen.");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    naechsteScheibe();
    state.auf = 1;
    state.nachladen = 0;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(700, 120 + ziel * 20);
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
    gegner?.ende(punkte);
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    kids()?.playJingle?.("win");
    const geschafft = state.scheibe ? state.scheibe.n : 0;
    const scheiben = geschafft === 1 ? "1 Scheibe geschafft" : `${geschafft} Scheiben geschafft`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${scheiben}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      speech: `${punkte} Punkte, ${scheiben}.${rekord ? " Das ist dein neuer Rekord!" : ""}`,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("dr-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Drehscheibe",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });
  gegner = window.LernappGeist?.fuer?.({ spiel: "dartWheel", host, art: "ziel" }) || null;

  startRun();

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    werfen();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    werfen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappDrehscheibe = {
    R, KOLL, state, view, neueScheibe, abstand, norm,
  };
})();
