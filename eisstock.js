/*
 * eisstock.js – Eisstock.
 * ---------------------------------------------------------------------------
 * Eine Eisbahn, von oben gesehen. Am Ende das Haus: vier Ringe, in der Mitte
 * der Punkt. Wer über das Bild wischt, schickt den Stein los – je länger der
 * Wisch, desto weiter gleitet er. Und wie beim Curling kommt es auf den Drall
 * an: Ein Wisch, der am Ende nach rechts abbiegt, gibt dem Stein Drall nach
 * rechts, und je langsamer er wird, desto mehr zieht er in diese Richtung.
 * Wer während des Gleitens den Finger aufs Bild legt, wischt das Eis vor dem
 * Stein: Er gleitet weiter und dreht weniger.
 *
 * Sechs Steine. Gezählt wird am Schluss, wo sie liegen: ganz innen 10, dann
 * 6, 3 und 1. Wer einen eigenen Stein aus dem Haus stösst, verliert ihn.
 * Die ersten beiden Steine gehen auf ein leeres Haus; dann liegt ein roter
 * Wächter im Weg, später zwei – und auf dem Eis eine stumpfe Stelle, auf der
 * der Stein schneller langsam wird.
 *
 * Ein Stein, der die Linie vor dem Haus nicht erreicht, oder einer, der an
 * die Bande stösst oder hinten hinausgleitet, ist aus dem Spiel.
 *
 * Gerechnet wird entlang der Bahn (v, von der Abwurflinie zum Haus) und quer
 * dazu (u, nach rechts gesehen vom Werfer). Gezeichnet wird die Bahn hochkant
 * auf einem hohen Bild und quer auf einem breiten.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "curling") return;

  const host = document.querySelector("#es-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  const art = window.LernappTrainArt;
  if (!host || !shellApi || !art) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Ohne Turnier Math.random; im Turnier liegen für alle dieselben
  // Wächter an denselben Stellen (zufall.js). Eissplitter würfeln weiter
  // Math.random.
  const zufall = window.LernappZufall?.fuer?.("iceStone") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Bahn
  // ---------------------------------------------------------------------------
  const BAHN = 110;                // so breit, Bande zu Bande
  const LAENGE = 520;              // dahinter ist die Bahn zu Ende
  const ABWURF = 30;               // hier beginnt der Stein zu gleiten
  const HAUS = 440;                // die Mitte des Hauses
  const LINIE = 368;               // wer diese Linie nicht erreicht, ist aus dem Spiel
  const RINGE = [
    { r: 10, punkte: 10, farbe: "#ffffff" },
    { r: 24, punkte: 6, farbe: "#e8473f" },
    { r: 38, punkte: 3, farbe: "#ffffff" },
    { r: 52, punkte: 1, farbe: "#3d7fd1" },
  ];
  const R = 7.5;                   // der Stein

  // Das Gleiten. Die Zahlen sind ausgespielt: Ein Stein, der genau ins Haus
  // soll, gleitet knapp vier Sekunden.
  const REIBUNG = 60;              // so viel Tempo verliert er je Sekunde
  const STUMPF = 2.1;              // auf der stumpfen Stelle so viel mehr
  const KURVE = 14;                // so stark zieht ganzer Drall zur Seite
  const WISCHEN_REIBUNG = 0.72;    // gewischt: weniger Reibung ...
  const WISCHEN_KURVE = 0.55;      // ... und weniger Drall
  const V_MIN = 170;
  const V_MAX = 290;
  const ZIEL_MAX = 0.24;           // so schräg kann er höchstens losgleiten
  const STOSS = 0.9;               // so viel Tempo bleibt bei einem Zusammenstoss
  const TAKT = 1 / 240;

  const STEINE = 6;

  const HELP = [
    "Eisstock. Wisch über das Bild nach vorn: Je länger der Wisch, desto weiter gleitet der Stein.",
    "Biegt dein Wisch am Ende ab, bekommt der Stein Drall und zieht, wenn er langsamer wird, in diese Richtung – wie beim Curling.",
    "Halte den Finger auf dem Bild, während er gleitet, dann wird das Eis gewischt: Er gleitet weiter und dreht weniger.",
    "Sechs Steine. Am Schluss zählt, wo sie liegen: innen 10, dann 6, 3 und 1. Rote Wächter liegen im Weg.",
  ].join(" ");

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.eisstock", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const von = (a, b) => a + zufall.zahl() * (b - a);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Wie viel ein Stein an dieser Stelle zählt.
  function wert(stein) {
    const d = Math.hypot(stein.u, stein.v - HAUS) - R;
    for (const ring of RINGE) if (d <= ring.r) return ring.punkte;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Was auf der Bahn liegt
  // ---------------------------------------------------------------------------
  // Vor jedem Stein steht fest, was neu dazukommt – allein aus dem Zufall:
  //
  //   Stein 1–2   ein leeres Haus
  //   Stein 3     ein roter Wächter vor dem Haus
  //   Stein 5     ein zweiter, und eine stumpfe Stelle auf dem Eis
  function plane() {
    const waechter = [];
    const neben = von(14, 26) * (zufall.zahl() < 0.5 ? -1 : 1);
    waechter.push({ ab: 2, u: neben, v: von(330, 372) });
    waechter.push({ ab: 4, u: -neben * von(0.4, 0.9), v: von(388, 405) });
    const stumpf = { ab: 4, u: von(-20, 20), v: von(240, 300), ru: von(22, 30), rv: von(34, 46) };
    return { waechter, stumpf };
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit", "spiel", "ende"
  // schritt: "warten" (auf den Wisch), "wischen" (der Finger zieht noch),
  //          "gleiten" (was liegt, bewegt sich), "zaehlen" (kurz nach dem Halt)
  const state = {
    phase: "bereit",
    schritt: "warten",
    plan: null,
    stein: 0,             // der wievielte gerade dran ist (0-basiert)
    steine: [],           // { u, v, vu, vv, spin, dreh, eigen, aus, blass }
    aktiv: null,          // der Stein, der gerade geworfen wurde
    stumpf: null,
    punkte: 0,
    spur: [],             // der Wisch, in Bildpunkten
    gedrueckt: false,     // während des Gleitens: es wird gewischt
    besen: 0,
    teile: [],
    schriften: [],
    zeit: 0,
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

  const view = { dpr: 1, w: 0, h: 0, s: 1, quer: false, ox: 0, oy: 0 };

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
    const platz = shell.el("div", "es-platz");
    feld = shell.el("div", "es-feld");
    canvas = document.createElement("canvas");
    canvas.className = "es-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Stein: ein Wisch, der am Ende abbiegt.
    const tipp = shell.el("span", "es-tipp");
    tipp.setAttribute("aria-hidden", "true");
    tipp.append(art.el("svg", { viewBox: "0 0 64 96" }, [
      art.el("path", { class: "es-tipp-weg", d: "M30 86 C28 60 26 38 38 14", stroke: "#ffffff", "stroke-width": 5, "stroke-linecap": "round", fill: "none" }),
      art.el("path", { d: "M30 14l9-2 1 9", stroke: "#ffffff", "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }),
    ]));
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  // Wie die Bahn ins Bild passt: hochkant, wenn das Bild höher als breit ist,
  // sonst quer. Immer ganz – das Haus muss beim Zielen zu sehen sein.
  function messen() {
    if (!canvas || !feld) return;
    const w = Math.max(80, feld.clientWidth);
    const h = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    if (w === view.w && h === view.h && dpr === view.dpr) return;
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    view.quer = w > h * 1.05;
    feld.dataset.lage = view.quer ? "quer" : "hoch";
    const lang = view.quer ? w : h;
    const kurz = view.quer ? h : w;
    view.s = Math.min(lang / (LAENGE + 26), kurz / (BAHN + 30));
    if (view.quer) {
      view.ox = (w - LAENGE * view.s) / 2;
      view.oy = h / 2;
    } else {
      view.ox = w / 2;
      view.oy = h - (h - LAENGE * view.s) / 2;
    }
    const pw = Math.round(w * dpr);
    const ph = Math.round(h * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Bahn → Bild.
  function insBild(u, v) {
    return view.quer
      ? { x: view.ox + v * view.s, y: view.oy + u * view.s }
      : { x: view.ox + u * view.s, y: view.oy - v * view.s };
  }

  // Ein Stück Weg im Bild → Bahn: vorwärts (f) und nach rechts (l).
  function aufBahn(dx, dy) {
    return view.quer ? { f: dx, l: dy } : { f: -dy, l: dx };
  }

  // Zeichnen in Bahnkoordinaten: u nach rechts, v nach vorn.
  function bahnTransform() {
    const s = view.s * view.dpr;
    if (view.quer) g.setTransform(0, s, s, 0, view.ox * view.dpr, view.oy * view.dpr);
    else g.setTransform(s, 0, 0, -s, view.ox * view.dpr, view.oy * view.dpr);
  }

  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  function kreis(x, y, r) {
    g.beginPath();
    g.arc(x, y, Math.max(0.05, r), 0, Math.PI * 2);
    g.fill();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function zeichneHalle() {
    bildTransform();
    const verlauf = g.createLinearGradient(0, 0, 0, view.h);
    verlauf.addColorStop(0, "#1d3550");
    verlauf.addColorStop(1, "#2b4a6b");
    g.fillStyle = verlauf;
    g.fillRect(0, 0, view.w, view.h);
    // Lichter der Halle, als weiche Flecken.
    for (let i = 0; i < 5; i += 1) {
      const x = view.w * (0.1 + i * 0.2);
      const schein = g.createRadialGradient(x, 0, 2, x, 0, Math.max(view.w, view.h) * 0.25);
      schein.addColorStop(0, "rgba(255, 245, 210, 0.16)");
      schein.addColorStop(1, "rgba(255, 245, 210, 0)");
      g.fillStyle = schein;
      g.fillRect(0, 0, view.w, view.h);
    }
  }

  function zeichneBahn() {
    bahnTransform();
    // Die Bande.
    g.fillStyle = "#c9d6e3";
    g.fillRect(-BAHN / 2 - 6, -10, BAHN + 12, LAENGE + 16);
    // Das Eis: hell, mit einem Schimmer, der über die Bahn zieht.
    const eis = g.createLinearGradient(-BAHN / 2, 0, BAHN / 2, 0);
    eis.addColorStop(0, "#e6f3fb");
    eis.addColorStop(0.5, "#f7fcff");
    eis.addColorStop(1, "#e2f0f9");
    g.fillStyle = eis;
    g.fillRect(-BAHN / 2, -6, BAHN, LAENGE + 6);
    const glanz = ruhig() ? 0.5 : 0.5 + 0.5 * Math.sin(state.zeit * 0.4);
    g.fillStyle = `rgba(255, 255, 255, ${0.35 + 0.2 * glanz})`;
    for (let i = 0; i < 6; i += 1) {
      const v = (i / 6) * LAENGE + glanz * 30;
      g.beginPath();
      g.moveTo(-BAHN / 2, v);
      g.lineTo(-BAHN / 2 + 26, v);
      g.lineTo(BAHN / 2, v + 60);
      g.lineTo(BAHN / 2 - 26, v + 60);
      g.closePath();
      g.fill();
    }
    // Kratzer im Eis, an festen Stellen.
    g.strokeStyle = "rgba(150, 180, 205, 0.25)";
    g.lineWidth = 0.6;
    g.beginPath();
    for (let i = 0; i < 40; i += 1) {
      const u = (hash01(i * 3.1) - 0.5) * BAHN * 0.9;
      const v = hash01(i * 7.7) * LAENGE;
      g.moveTo(u, v);
      g.lineTo(u + (hash01(i * 5.3) - 0.5) * 14, v + (hash01(i * 2.2) - 0.5) * 6);
    }
    g.stroke();

    // Die stumpfe Stelle: Reif auf dem Eis.
    const st = state.stumpf;
    if (st) {
      g.fillStyle = "rgba(205, 222, 236, 0.85)";
      g.beginPath();
      g.ellipse(st.u, st.v, st.ru, st.rv, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255, 255, 255, 0.8)";
      for (let i = 0; i < 26; i += 1) {
        const w = hash01(i * 4.4) * Math.PI * 2;
        const a = Math.sqrt(hash01(i * 9.1));
        kreis(st.u + Math.cos(w) * st.ru * a, st.v + Math.sin(w) * st.rv * a, 0.9);
      }
    }

    // Das Haus.
    for (let i = RINGE.length - 1; i >= 0; i -= 1) {
      g.fillStyle = RINGE[i].farbe;
      kreis(0, HAUS, RINGE[i].r);
    }
    g.fillStyle = "#3d7fd1";
    kreis(0, HAUS, 3);
    // Linien: Mittellinie, die Linie vor dem Haus, die Linie durch das Haus,
    // die Abwurflinie.
    g.strokeStyle = "rgba(60, 90, 130, 0.45)";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, ABWURF);
    g.lineTo(0, LAENGE);
    g.moveTo(-BAHN / 2, HAUS);
    g.lineTo(BAHN / 2, HAUS);
    g.stroke();
    g.strokeStyle = "rgba(200, 60, 60, 0.7)";
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(-BAHN / 2, LINIE);
    g.lineTo(BAHN / 2, LINIE);
    g.stroke();
    g.strokeStyle = "rgba(60, 90, 130, 0.6)";
    g.beginPath();
    g.moveTo(-BAHN / 2, ABWURF);
    g.lineTo(BAHN / 2, ABWURF);
    g.stroke();
  }

  // Ein Stein: Granit, darüber der Griff in der Farbe des Teams. Der Griff
  // dreht sich mit dem Drall – so sieht man, dass er dreht.
  function zeichneStein(stein) {
    if (stein.blass <= 0) return;
    g.save();
    g.globalAlpha = stein.blass;
    g.translate(stein.u, stein.v);
    g.fillStyle = "rgba(30, 50, 80, 0.22)";
    kreis(0.9, -1.2, R + 0.6);
    g.fillStyle = "#6f7584";
    kreis(0, 0, R);
    g.fillStyle = "#9aa1af";
    kreis(-0.6, 0.6, R * 0.78);
    g.fillStyle = "#b9bfca";
    kreis(-1.4, 1.6, R * 0.32);
    g.rotate(stein.dreh);
    g.fillStyle = stein.eigen ? "#f5c518" : "#e8473f";
    kreis(0, 0, R * 0.48);
    g.fillRect(-R * 0.18, -R * 0.15, R * 0.36, R * 0.95);
    g.fillStyle = stein.eigen ? "#c99a00" : "#a8321f";
    kreis(0, R * 0.85, R * 0.2);
    g.restore();
  }

  // Der Besen, der vor dem Stein wischt.
  function zeichneBesen() {
    const s = state.aktiv;
    if (!s || !state.gedrueckt || state.schritt !== "gleiten") return;
    const tempo = Math.hypot(s.vu, s.vv);
    if (tempo < 4) return;
    const fu = s.vu / tempo;
    const fv = s.vv / tempo;
    const hin = ruhig() ? 0 : Math.sin(state.besen * 24) * 5;
    const bu = s.u + fu * (R + 7) + fv * hin;
    const bv = s.v + fv * (R + 7) - fu * hin;
    g.save();
    g.translate(bu, bv);
    g.rotate(Math.atan2(fv, fu));
    g.fillStyle = "#7a3b1f";
    g.fillRect(-1.6, -6, 3.2, 12);
    g.fillStyle = "#f2c94c";
    g.fillRect(-0.4, -6, 1.4, 12);
    g.restore();
    g.fillStyle = "rgba(255, 255, 255, 0.5)";
    kreis(bu + (Math.random() - 0.5) * 6, bv + (Math.random() - 0.5) * 6, 0.9);
  }

  // Der Wisch, solange der Finger zieht: eine helle Spur im Bild.
  function zeichneWisch() {
    if (state.spur.length < 2) return;
    bildTransform();
    g.lineCap = "round";
    g.lineJoin = "round";
    for (let i = 1; i < state.spur.length; i += 1) {
      const k = i / state.spur.length;
      g.strokeStyle = `rgba(255, 255, 255, ${0.25 + 0.6 * k})`;
      g.lineWidth = 3 + 5 * k;
      g.beginPath();
      g.moveTo(state.spur[i - 1].x, state.spur[i - 1].y);
      g.lineTo(state.spur[i].x, state.spur[i].y);
      g.stroke();
    }
  }

  function zeichneTeile() {
    state.teile.forEach((t) => {
      g.globalAlpha = clamp(t.leben / t.max, 0, 1);
      g.fillStyle = t.farbe;
      kreis(t.u, t.v, t.r);
    });
    g.globalAlpha = 1;
  }

  // Oben: die übrigen Steine und der Stand im Haus.
  function zeichneAnzeige() {
    bildTransform();
    const gross = clamp(Math.min(view.w, view.h) * 0.045, 12, 18);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textBaseline = "middle";
    g.textAlign = "left";
    const text = `Haus ${state.punkte}`;
    const w = g.measureText(text).width + gross * 1.2;
    const x = 10;
    const y = 10;
    g.fillStyle = "rgba(10, 30, 50, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, gross * 1.7, gross * 0.85);
    else g.rect(x, y, w, gross * 1.7);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 0.6, y + gross * 0.86);
    const r = gross * 0.36;
    for (let i = 0; i < STEINE; i += 1) {
      const px = x + r + i * r * 2.6;
      const py = y + gross * 1.7 + r + 6;
      g.fillStyle = i < state.stein || (i === state.stein && state.schritt !== "warten" && state.schritt !== "wischen")
        ? "rgba(255, 255, 255, 0.3)"
        : "#f5c518";
      kreis(px, py, r);
    }
  }

  function zeichneSchriften() {
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((s) => {
      const k = clamp(s.leben / s.max, 0, 1);
      const p = insBild(s.u, s.v);
      g.globalAlpha = Math.min(1, k * 2);
      g.font = `900 ${Math.round(s.gross)}px system-ui, sans-serif`;
      g.lineWidth = 4;
      g.strokeStyle = "rgba(10, 30, 50, 0.6)";
      const y = p.y - (1 - k) * 22;
      g.strokeText(s.text, p.x, y);
      g.fillStyle = s.farbe;
      g.fillText(s.text, p.x, y);
    });
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    zeichneHalle();
    zeichneBahn();
    state.steine.forEach(zeichneStein);
    // Der nächste Stein wartet an der Abwurflinie.
    if (state.phase !== "ende" && (state.schritt === "warten" || state.schritt === "wischen") && state.stein < STEINE) {
      zeichneStein({ u: 0, v: ABWURF, dreh: 0, eigen: true, blass: 1 });
    }
    zeichneBesen();
    zeichneTeile();
    zeichneWisch();
    zeichneAnzeige();
    zeichneSchriften();
  }

  // ---------------------------------------------------------------------------
  // Werfen
  // ---------------------------------------------------------------------------
  // Aus dem Wisch: wie weit nach vorn (Kraft), wie schräg (Richtung) und wie
  // er am Ende abbiegt (Drall). Gemessen wird in Bildpunkten, umgerechnet
  // auf die Bahn – hochkant wie quer dasselbe.
  function wurfAus(spur) {
    const a = spur[0];
    const e = spur[spur.length - 1];
    const ganz = aufBahn(e.x - a.x, e.y - a.y);
    if (ganz.f < 24) return null;
    const vorn = (view.quer ? view.w : view.h) * 0.5;
    const kraft = clamp((ganz.f - 24) / (vorn - 24), 0, 1);
    const richtung = clamp(Math.atan2(ganz.l, ganz.f) * 0.5, -ZIEL_MAX, ZIEL_MAX);
    // Der Drall: wie weit das letzte Drittel des Wischs von seiner ganzen
    // Richtung abbiegt.
    const ab = spur[Math.max(0, Math.floor(spur.length * 0.66) - 1)];
    const ende = aufBahn(e.x - ab.x, e.y - ab.y);
    let spin = 0;
    if (Math.hypot(ende.f, ende.l) > 6) {
      const knick = Math.atan2(ende.l, Math.max(1, ende.f)) - Math.atan2(ganz.l, ganz.f);
      spin = clamp(knick / 0.6, -1, 1);
    }
    return { tempo: lerp(V_MIN, V_MAX, kraft), richtung, spin };
  }

  function werfen(wurf) {
    const stein = {
      u: 0, v: ABWURF,
      vu: Math.sin(wurf.richtung) * wurf.tempo,
      vv: Math.cos(wurf.richtung) * wurf.tempo,
      spin: wurf.spin, dreh: 0, eigen: true, aus: false, blass: 1,
    };
    state.steine.push(stein);
    state.aktiv = stein;
    state.schritt = "gleiten";
    kids()?.vibrate?.(10);
  }

  // ---------------------------------------------------------------------------
  // Eingabe
  // ---------------------------------------------------------------------------
  function druecken(event) {
    if (state.phase === "ende") return;
    if (state.schritt === "gleiten") { state.gedrueckt = true; return; }
    if (state.schritt !== "warten" || state.stein >= STEINE) return;
    if (state.phase === "bereit") {
      state.phase = "spiel";
      shell.setPhase("play");
      gegner?.los();
    }
    const box = canvas.getBoundingClientRect();
    state.spur = [{ x: event.clientX - box.left, y: event.clientY - box.top, id: event.pointerId }];
    state.schritt = "wischen";
    try { host.setPointerCapture(event.pointerId); } catch { /* dann ohne Bindung */ }
  }

  function ziehen(event) {
    if (state.schritt !== "wischen" || !state.spur.length || event.pointerId !== state.spur[0].id) return;
    const box = canvas.getBoundingClientRect();
    state.spur.push({ x: event.clientX - box.left, y: event.clientY - box.top });
    if (state.spur.length > 80) state.spur.splice(1, 1);
  }

  function loslassen(event) {
    state.gedrueckt = false;
    if (state.schritt !== "wischen") return;
    if (event && state.spur.length && event.pointerId !== state.spur[0].id) return;
    const wurf = state.spur.length > 2 ? wurfAus(state.spur) : null;
    state.spur = [];
    if (!wurf) { state.schritt = "warten"; return; }
    werfen(wurf);
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  function aufStumpf(stein) {
    const st = state.stumpf;
    if (!st) return false;
    const du = (stein.u - st.u) / st.ru;
    const dv = (stein.v - st.v) / st.rv;
    return du * du + dv * dv <= 1;
  }

  function physik(h) {
    const liste = state.steine.filter((s) => !s.aus);
    liste.forEach((s) => {
      const tempo = Math.hypot(s.vu, s.vv);
      if (tempo < 0.5) { s.vu = 0; s.vv = 0; return; }
      const gewischt = s === state.aktiv && state.gedrueckt;
      let reib = REIBUNG * (aufStumpf(s) ? STUMPF : 1);
      if (gewischt) reib *= WISCHEN_REIBUNG;
      // Der Drall zieht quer zur Fahrt, und umso mehr, je langsamer der
      // Stein ist.
      const zug = KURVE * s.spin * clamp(1 - tempo / 250, 0.25, 1) * (gewischt ? WISCHEN_KURVE : 1);
      const fu = s.vu / tempo;
      const fv = s.vv / tempo;
      s.vu += (fv * zug) * h;
      s.vv += (-fu * zug) * h;
      const neu = Math.max(0, Math.hypot(s.vu, s.vv) - reib * h);
      const jetzt = Math.hypot(s.vu, s.vv) || 1;
      s.vu *= neu / jetzt;
      s.vv *= neu / jetzt;
      s.u += s.vu * h;
      s.v += s.vv * h;
      s.dreh -= s.spin * h * (2 + tempo / 60);
    });
    // Zusammenstösse: gleich schwere Steine tauschen, was sie aufeinander zu
    // bewegt, und schieben sich auseinander.
    for (let i = 0; i < liste.length; i += 1) {
      for (let j = i + 1; j < liste.length; j += 1) {
        const a = liste[i];
        const b = liste[j];
        const du = b.u - a.u;
        const dv = b.v - a.v;
        const d = Math.hypot(du, dv);
        if (d >= R * 2 || d < 0.001) continue;
        const nu = du / d;
        const nv = dv / d;
        const ueber = R * 2 - d;
        a.u -= nu * ueber / 2;
        a.v -= nv * ueber / 2;
        b.u += nu * ueber / 2;
        b.v += nv * ueber / 2;
        const rel = (a.vu - b.vu) * nu + (a.vv - b.vv) * nv;
        if (rel <= 0) continue;
        const j2 = rel * (1 + STOSS) / 2;
        a.vu -= j2 * nu;
        a.vv -= j2 * nv;
        b.vu += j2 * nu;
        b.vv += j2 * nv;
        b.spin = clamp(b.spin + a.spin * 0.2, -1, 1);
        a.spin *= 0.6;
        state.knall = Math.min(1, rel / 160);
        splitter(a.u + nu * R, a.v + nv * R, 6);
        kids()?.vibrate?.(12);
      }
    }
    // Bande und Ende der Bahn: Wer dort ankommt, ist aus dem Spiel.
    liste.forEach((s) => {
      if (Math.abs(s.u) > BAHN / 2 - R || s.v > LAENGE - R) {
        s.aus = true;
        s.vu = 0;
        s.vv = 0;
        state.schriften.push({ text: "Aus", u: clamp(s.u, -BAHN / 2 + 10, BAHN / 2 - 10), v: Math.min(s.v, LAENGE - 12), farbe: "#ffffff", gross: 16, leben: 0.9, max: 0.9 });
      }
    });
  }

  function allesRuht() {
    return state.steine.every((s) => s.aus || Math.hypot(s.vu, s.vv) < 0.5);
  }

  // Der Stand im Haus: nur die eigenen Steine zählen.
  function zaehlen() {
    return state.steine.filter((s) => s.eigen && !s.aus).reduce((summe, s) => summe + wert(s), 0);
  }

  function steinRuht() {
    const s = state.aktiv;
    state.aktiv = null;
    state.gedrueckt = false;
    // Zu kurz: Er hat die Linie vor dem Haus nicht erreicht.
    if (s && !s.aus && s.v < LINIE) {
      s.aus = true;
      state.schriften.push({ text: "Zu kurz", u: s.u, v: s.v + 16, farbe: "#ffffff", gross: 16, leben: 1, max: 1 });
      kids()?.playJingle?.("retry");
    } else if (s && !s.aus) {
      const w = wert(s);
      state.schriften.push({ text: w ? `+${w}` : "0", u: s.u, v: s.v + 16, farbe: w >= 6 ? "#ffd23f" : "#ffffff", gross: w >= 10 ? 22 : 17, leben: 1, max: 1 });
      kids()?.playJingle?.(w >= 10 ? "unlock" : w >= 3 ? "correct" : "star");
      if (w >= 10) kids()?.vibrate?.([14, 30, 14]);
    } else {
      kids()?.playJingle?.("retry");
    }
    state.punkte = zaehlen();
    shell.setCount(state.punkte);
    gegner?.takt(state.punkte);
    state.schritt = "zaehlen";
    stepTimer = window.setTimeout(naechster, 750);
  }

  function naechster() {
    stepTimer = null;
    state.stein += 1;
    if (state.stein >= STEINE) { finish(); return; }
    legeHin();
    state.schritt = "warten";
  }

  // Was vor diesem Stein neu auf die Bahn kommt: Wächter, stumpfe Stelle.
  function legeHin() {
    state.plan.waechter.forEach((w) => {
      if (w.ab !== state.stein) return;
      state.steine.push({ u: w.u, v: w.v, vu: 0, vv: 0, spin: 0, dreh: hash01(w.v) * 6, eigen: false, aus: false, blass: 1 });
    });
    if (state.plan.stumpf.ab === state.stein) state.stumpf = state.plan.stumpf;
  }

  function splitter(u, v, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const tempo = 20 + Math.random() * 50;
      state.teile.push({ u, v, vu: Math.cos(w) * tempo, vv: Math.sin(w) * tempo, r: 0.6 + Math.random() * 1, leben: 0.5, max: 0.5, farbe: "rgba(255, 255, 255, 0.9)" });
    }
  }

  function schritt(dt) {
    state.zeit += dt;
    state.besen += dt;
    if (state.schritt === "gleiten") {
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n; i += 1) physik(dt / n);
      if (state.gedrueckt && state.aktiv && !state.aktiv.aus) {
        if (Math.random() < 0.6) splitter(state.aktiv.u + (Math.random() - 0.5) * 8, state.aktiv.v + R + 6, 1);
      }
      if (allesRuht()) steinRuht();
    }
    state.steine.forEach((s) => { if (s.aus && s.blass > 0) s.blass = Math.max(0, s.blass - dt * 1.5); });
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.u += t.vu * dt;
      t.v += t.vv * dt;
      t.vu *= 1 - 3 * dt;
      t.vv *= 1 - 3 * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
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
    schritt(dt);
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
    state.schritt = "warten";
    state.plan = plane();
    state.stein = 0;
    state.steine = [];
    state.aktiv = null;
    state.stumpf = null;
    state.punkte = 0;
    state.spur = [];
    state.gedrueckt = false;
    state.teile = [];
    state.schriften = [];
    state.zeit = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt es-prompt", "Wisch nach vorn – ein Bogen am Ende gibt Drall.");
    shell.play.append(prompt, buildPlatz());
    view.w = 0;
    view.h = 0;
    messen();
    legeHin();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(700, 120 + ziel * 10);
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
    const punkte = zaehlen();
    gegner?.ende(punkte);
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    kids()?.playJingle?.("win");
    const imHaus = state.steine.filter((s) => s.eigen && !s.aus && wert(s) > 0).length;
    const satz = `${imHaus} von ${STEINE} Steinen im Haus`;
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${satz}${vorher ? ` · Bestwert ${vorher}` : ""}`,
      speech: `${punkte} Punkte. ${satz}.${rekord ? " Das ist dein neuer Rekord!" : ""}`,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("es-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Eisstock",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });
  gegner = window.LernappGeist?.fuer?.({ spiel: "iceStone", host, art: "ziel" }) || null;

  startRun();

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken(event);
  });
  host.addEventListener("pointermove", ziehen);
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", () => {
    state.gedrueckt = false;
    if (state.schritt === "wischen") { state.spur = []; state.schritt = "warten"; }
  });
  window.addEventListener("blur", () => { state.gedrueckt = false; });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); });

  // Für die Prüfskripte.
  window.LernappEisstock = {
    BAHN, LAENGE, ABWURF, HAUS, LINIE, R, RINGE, V_MIN, V_MAX, REIBUNG, KURVE, STEINE,
    state, view, plane, wert, wurfAus, werfen, insBild,
  };
})();
