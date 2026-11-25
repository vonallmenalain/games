/*
 * weichensteller.js – Weichensteller: zusammen die Loks in ihre Bahnhöfe.
 * ---------------------------------------------------------------------------
 * Die Seite /weichensteller. Ein Spiel miteinander, in Echtzeit (echtzeit.js).
 * Oben kommen nacheinander Loks aus dem Tunnel, jede in einer Farbe mit
 * einem Zeichen: rot ●, gelb ▲, grün ■, blau ◆. Unten stehen vier Bahnhöfe
 * in diesen Farben. Dazwischen drei Weichen: die obere schickt eine Lok
 * nach links (rot, gelb) oder rechts (grün, blau), die beiden unteren dann
 * in den einen oder anderen Bahnhof.
 *
 * Die Weichen sind aufgeteilt: Wer die Partie beginnt, stellt die obere,
 * die andere die beiden unteren. Eine Lok kommt nur richtig an, wenn beide
 * aufpassen. Jede Lok im richtigen Bahnhof bringt einen Stern, jede im
 * falschen kostet ein Herz (von dreien). Sind alle Loks angekommen und ist
 * noch ein Herz da, ist es geschafft.
 *
 * Wie viele Loks kommen und wie schnell sie fahren, kommt aus der Stufe
 * (gegen den Computer) oder, zu zweit, der wievielten Partie. Gerechnet
 * wird in Ticks zu 100 ms, mit ganzen Zahlen – jedes Gerät gleich.
 *
 * Ein Zug ist «S» (Los!), «a37:W0» (bei Tick 37 die Weiche 0 umstellen)
 * oder «E412» (bei Tick 412 ist es aus).
 *
 * Der Computer stellt seine Weichen, sobald eine Lok auf sie zufährt.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "weichensteller") return;

  const Z = window.LernappZwei;
  const E = window.LernappEchtzeit;
  if (!Z || !E) return;
  const el = Z.el;

  const HERZEN = 3;
  const MAX_TICK = 3000;
  const STUFE_GRAD = { leicht: 0, einfach: 1, mittel: 2, schwer: 3 };
  // Die Strecke in Zehnteln: vom Tunnel zur oberen Weiche, weiter zu einer
  // unteren, weiter in einen Bahnhof.
  const L0 = 280;
  const L1 = 400;
  const L2 = 460;
  const LANG = L0 + L1 + L2;
  // So lange vor der Abfahrt wartet eine Lok schon im Tunnel (sichtbar).
  const VORLAUF = 20;
  // Je Grad: wie viele Loks, wie schnell (Zehntel je Tick), wie weit
  // auseinander (Ticks).
  const GRADE = [
    { zahl: 6, tempo: 9, abstand: 120 },
    { zahl: 8, tempo: 10, abstand: 90 },
    { zahl: 10, tempo: 12, abstand: 70 },
    { zahl: 12, tempo: 14, abstand: 56 },
  ];
  const FARBEN = [
    { name: "rot", zeichen: "●", lok: "rote" },
    { name: "gelb", zeichen: "▲", lok: "gelbe" },
    { name: "grün", zeichen: "■", lok: "grüne" },
    { name: "blau", zeichen: "◆", lok: "blaue" },
  ];
  // Fürs Bild: Punkte in einem Feld 100 × 120.
  const PUNKT = {
    tunnel: [50, 5],
    weiche: [[50, 33], [26, 64], [74, 64]],
    bahnhof: [[12, 106], [38, 106], [62, 106], [88, 106]],
  };

  function wuerfel(saat) {
    let t = (Number(saat) >>> 0) || 1;
    return () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gradVon = (saat, stufe) => (stufe && STUFE_GRAD[stufe] !== undefined ? STUFE_GRAD[stufe] : Math.min(3, (Number(saat) >>> 29) & 3));
  const anderer = (s) => (s === "a" ? "b" : "a");
  // Wer welche Weiche stellt: die obere, wer beginnt, die unteren die andere.
  const besitzer = (k, beginnt) => (k === 0 ? beginnt : anderer(beginnt));

  // Der Fahrplan: welche Loks in welcher Farbe wann losfahren. Die Farben
  // kommen aus einem Beutel (je vier, gemischt) – jede Farbe kommt dran,
  // keine dreimal hintereinander.
  function planVon(saat, stufe) {
    const grad = gradVon(saat, stufe);
    const g = GRADE[grad];
    const rnd = wuerfel(((Number(saat) >>> 0) ^ 0x7a11) >>> 0);
    const farben = [];
    while (farben.length < g.zahl) {
      const beutel = [0, 1, 2, 3];
      for (let i = 3; i > 0; i -= 1) {
        const j = Math.floor(rnd() * (i + 1));
        [beutel[i], beutel[j]] = [beutel[j], beutel[i]];
      }
      farben.push(...beutel);
    }
    farben.length = g.zahl;
    let t = VORLAUF + 5;
    const loks = farben.map((farbe) => {
      const start = t;
      t += g.abstand + (grad ? Math.floor(rnd() * 12) : 0);
      return { farbe, start };
    });
    return { grad, tempo: g.tempo, loks };
  }

  // --- Die Simulation (nur ganze Zahlen) ---------------------------------------
  function start(plan) {
    return {
      tick: -1,
      weichen: [0, 0, 0],
      loks: plan.loks.map(() => ({ p: 0, oben: null, unten: null, bahnhof: null, da: null })),
      herzen: HERZEN,
      richtig: 0,
      falsch: 0,
      ende: null,
      endTick: null,
    };
  }

  function schritt(s, plan) {
    s.tick += 1;
    plan.loks.forEach((lok, i) => {
      const z = s.loks[i];
      if (z.bahnhof !== null || s.tick < lok.start) return;
      const vor = z.p;
      z.p += plan.tempo;
      if (vor < L0 && z.p >= L0) z.oben = s.weichen[0];
      if (vor < L0 + L1 && z.p >= L0 + L1) z.unten = s.weichen[1 + z.oben];
      if (z.p >= LANG) {
        z.p = LANG;
        z.bahnhof = z.oben * 2 + z.unten;
        z.da = s.tick;
        if (z.bahnhof === lok.farbe) s.richtig += 1;
        else { s.falsch += 1; s.herzen -= 1; }
      }
    });
    if (!s.ende && s.herzen <= 0) { s.ende = "v"; s.endTick = s.tick; }
    else if (!s.ende && s.loks.every((z) => z.bahnhof !== null)) { s.ende = "g"; s.endTick = s.tick; }
  }

  // Schritt für Schritt vorwärts: Die Aktionen eines Ticks gelten vor
  // seinem Schritt.
  function simulator(plan, aktionen) {
    const s = start(plan);
    let i = 0;
    return {
      s,
      bis(t) {
        while (s.tick < t && !s.ende) {
          const n = s.tick + 1;
          while (i < aktionen.length && aktionen[i].tick <= n) { s.weichen[Number(aktionen[i].art[1])] ^= 1; i += 1; }
          schritt(s, plan);
        }
        return s;
      },
    };
  }
  const simuliere = (plan, aktionen, bis) => simulator(plan, aktionen).bis(bis);

  // Was eine Weiche für die nächste Lok braucht: { i, soll, p } – oder null,
  // wenn gerade keine Lok auf sie zufährt (oder man es noch nicht weiss).
  function bedarf(plan, s, k) {
    for (let i = 0; i < plan.loks.length; i += 1) {
      const lok = plan.loks[i];
      const z = s.loks[i];
      if (z.bahnhof !== null) continue;
      if (k === 0) {
        if (z.oben !== null) continue;
        if (s.tick < lok.start - VORLAUF) return null;
        return { i, soll: lok.farbe >> 1, p: z.p, vor: L0 };
      }
      if (z.unten !== null) continue;
      if (z.oben === null) return null;
      if (1 + z.oben !== k) continue;
      // Auf der falschen Seite: Für diese Lok ist es egal.
      if ((lok.farbe >> 1) !== z.oben) continue;
      return { i, soll: lok.farbe & 1, p: z.p, vor: L0 + L1 };
    }
    return null;
  }

  // Ob eine Seite jetzt eine Weiche umstellt – wie eine gute Partnerin:
  // sobald die Lok ein Stück auf die Weiche zugefahren ist.
  function willStellen(plan, s, k) {
    const b = bedarf(plan, s, k);
    if (!b || s.weichen[k] === b.soll) return false;
    const anfang = k === 0 ? 0 : L0;
    return b.p >= anfang + (b.vor - anfang) * 0.3;
  }

  // --- Die Regeln -----------------------------------------------------------------
  const WEICHE = /^W[012]$/;
  const gueltigFuer = (beginnt) => (wer, art) => WEICHE.test(art) && besitzer(Number(art[1]), beginnt) === wer;

  function lage(zuege, { saat, stufe, beginnt = "a" }) {
    const plan = planVon(saat, stufe);
    const z = E.lese(zuege, { aktionGueltig: gueltigFuer(beginnt), maxTick: MAX_TICK });
    const grund = { plan, beginnt, zahl: zuege.length, aktionen: z.aktionen, letzter: z.letzter, gestartet: z.gestartet };
    if (z.kaputt) return { ...grund, phase: "fahrt", dran: null, ende: null, kaputt: true, stand: simuliere(plan, z.aktionen, Math.max(0, z.letzterTick)) };
    if (!z.gestartet) return { ...grund, phase: "bereit", dran: "beide", ende: null, stand: start(plan) };
    if (z.ende !== null) {
      const s = simuliere(plan, z.aktionen.filter((a) => a.tick <= z.ende), z.ende);
      return { ...grund, phase: "ende", dran: null, ende: s.ende || "v", stand: s, endeTick: z.ende };
    }
    return { ...grund, phase: "fahrt", dran: "beide", ende: null, stand: simuliere(plan, z.aktionen, Math.max(0, z.letzterTick)), letzterTick: z.letzterTick };
  }

  function darf(l, zug, sitz) {
    if (l.ende || l.kaputt) return false;
    if (zug === "S") return l.phase === "bereit";
    if (l.phase !== "fahrt") return false;
    const e = E.ENDE.exec(zug);
    if (e) {
      const t = Number(e[1]);
      return t <= MAX_TICK && Boolean(simuliere(l.plan, l.aktionen.filter((a) => a.tick <= t), t).ende);
    }
    return E.darfAktion(l, zug, sitz, { aktionGueltig: gueltigFuer(l.beginnt), maxTick: MAX_TICK });
  }

  // --- Der Computer und die Planerin für die Prüfung -------------------------
  const uhrVon = (modus, nr, saat) => E.uhrFuer(`weichensteller|${modus}|${nr}|${saat}`);

  // Der Computer schaut voraus, wann er welche Weiche stellen muss – die
  // Zukunft hängt nur an den Zügen; stellt das Kind etwas, rechnet er neu.
  function computer(l, sitz, stufe, { nr, saat } = {}) {
    if (l.ende || l.phase !== "fahrt") return null;
    const uhr = uhrVon("computer", nr, saat);
    uhr.stellen(l.letzterTick ?? -1);
    const jetzt = uhr.tick();
    const meine = [0, 1, 2].filter((k) => besitzer(k, l.beginnt) === sitz);
    const ab = Math.max(jetzt, (l.letzter?.[sitz] ?? -1) + 1, 0);
    const sim = simulator(l.plan, l.aktionen);
    sim.bis(ab - 1);
    for (let t = ab; t <= MAX_TICK; t += 1) {
      if (sim.s.ende) return null;
      const k = meine.find((w) => willStellen(l.plan, sim.s, w));
      if (k !== undefined) return { zug: `${sitz}${t}:W${k}`, warte: Math.max(0, (t - jetzt) * E.TICK_MS) };
      sim.bis(t);
    }
    return null;
  }

  // Eine ganze Fahrt, beide wie der Computer (oder böse: niemand stellt
  // etwas) – für die Prüfungen.
  function fahrt(plan, { beginnt = "a", boese = false } = {}) {
    const s = start(plan);
    const aktionen = [];
    for (let t = 0; t <= MAX_TICK && !s.ende; t += 1) {
      if (!boese) {
        for (const k of [0, 1, 2]) {
          if (willStellen(plan, s, k)) { s.weichen[k] ^= 1; aktionen.push({ wer: besitzer(k, beginnt), tick: t, art: `W${k}` }); }
        }
      }
      schritt(s, plan);
    }
    aktionen.sort((x, y) => x.tick - y.tick || (x.wer < y.wer ? -1 : x.wer > y.wer ? 1 : 0));
    return { aktionen, ende: s.ende, endTick: s.endTick, stand: s };
  }

  // --- Was über dem Bild steht ---------------------------------------------------
  function satz(l, { ich }) {
    if (l.ende) return null;
    if (l.phase === "bereit") return { text: "Du beginnst – tippt «Los!», dann stellt die Weichen!", sitz: ich || null };
    if (!ich) return null;
    return besitzer(0, l.beginnt) === ich
      ? { text: "Du stellst die obere Weiche – jede Lok zu ihrer Farbe!", sitz: ich }
      : { text: "Du stellst die unteren Weichen – jede Lok zu ihrer Farbe!", sitz: ich };
  }

  // --- Das Bild -------------------------------------------------------------------
  const SVG = "http://www.w3.org/2000/svg";
  // Die Gleisstücke: [von, nach, wann es leuchtet (Weiche, Stellung)].
  const STUECKE = [
    [PUNKT.tunnel, PUNKT.weiche[0], null],
    [PUNKT.weiche[0], PUNKT.weiche[1], [0, 0]],
    [PUNKT.weiche[0], PUNKT.weiche[2], [0, 1]],
    [PUNKT.weiche[1], PUNKT.bahnhof[0], [1, 0]],
    [PUNKT.weiche[1], PUNKT.bahnhof[1], [1, 1]],
    [PUNKT.weiche[2], PUNKT.bahnhof[2], [2, 0]],
    [PUNKT.weiche[2], PUNKT.bahnhof[3], [2, 1]],
  ];

  // Wo eine Lok gerade ist (fürs Bild, mit Bruchteilen).
  function ort(z, p, weichen) {
    const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    if (p < L0) return mix(PUNKT.tunnel, PUNKT.weiche[0], p / L0);
    const oben = z.oben ?? weichen[0];
    if (p < L0 + L1) return mix(PUNKT.weiche[0], PUNKT.weiche[1 + oben], (p - L0) / L1);
    const unten = z.unten ?? weichen[1 + oben];
    return mix(PUNKT.weiche[1 + oben], PUNKT.bahnhof[oben * 2 + unten], Math.min(1, (p - L0 - L1) / L2));
  }

  function held() {
    const bild = el("div", "zw-ws-held");
    bild.append(el("span", "zw-ws-held-gleis ist-oben"), el("span", "zw-ws-held-gleis ist-links"), el("span", "zw-ws-held-gleis ist-rechts"));
    FARBEN.slice(0, 2).forEach((f, i) => bild.append(el("span", `zw-ws-held-bahnhof ist-${i}`, f.zeichen)));
    bild.append(el("span", "zw-ws-lok ist-held ist-f0", FARBEN[0].zeichen));
    return bild;
  }

  function brett({ zug, ton, ruhig, knopf }) {
    const knoten = el("div", "vr-feld zw-ws");
    knoten.dataset.zuege = "0";
    const kopf = el("div", "zw-ws-kopf");
    const herzen = el("span", "zw-ws-herzen");
    const loksZahl = el("span", "zw-ws-zahl");
    const sterne = el("span", "zw-ws-sterne");
    kopf.append(herzen, loksZahl, sterne);
    const netz = el("div", "zw-ws-netz");
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 100 120");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("zw-ws-gleise");
    const linien = STUECKE.map(([a, b]) => {
      const bett = document.createElementNS(SVG, "line");
      const schiene = document.createElementNS(SVG, "line");
      [bett, schiene].forEach((x) => { x.setAttribute("x1", a[0]); x.setAttribute("y1", a[1]); x.setAttribute("x2", b[0]); x.setAttribute("y2", b[1]); });
      bett.classList.add("zw-ws-bett");
      schiene.classList.add("zw-ws-schiene");
      svg.append(bett);
      return schiene;
    });
    linien.forEach((x) => svg.append(x));
    const tunnel = el("span", "zw-ws-tunnel");
    const lage0 = (x, y) => ({ left: `${x}%`, top: `${(y / 120) * 100}%` });
    Object.assign(tunnel.style, lage0(...PUNKT.tunnel));
    const bahnhoefe = PUNKT.bahnhof.map(([x, y], i) => {
      const b = el("span", `zw-ws-bahnhof ist-f${i}`);
      b.append(el("span", "zw-ws-bahnhof-zeichen", FARBEN[i].zeichen));
      b.setAttribute("aria-label", `Bahnhof ${FARBEN[i].name}`);
      Object.assign(b.style, lage0(x, y));
      return b;
    });
    const weichen = PUNKT.weiche.map(([x, y], k) => {
      const w = el("button", "zw-ws-weiche");
      w.type = "button";
      w.dataset.weiche = String(k);
      Object.assign(w.style, lage0(x, y));
      w.addEventListener("pointerdown", (e) => { e.preventDefault(); stellen(k); });
      w.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); stellen(k); } });
      return w;
    });
    const lokSchicht = el("div", "zw-ws-lokschicht");
    netz.append(svg, tunnel, ...bahnhoefe, lokSchicht, ...weichen);
    const unten = el("div", "zw-ws-unten");
    const los = knopf("Los!", "zw-ws-los mini-knopf mini-knopf-voll", () => zug("S"));
    unten.append(los);
    knoten.append(kopf, netz, unten);

    let letzte = null;
    let planFuer = "";
    let lokEl = [];
    let lauf = 0;
    let uhr = E.uhr();
    let endeGeschickt = -1;
    let gezeigt = { herzen: HERZEN, richtig: 0 };

    function stellen(k) {
      if (!letzte) return;
      const { lage: l, ich, aus } = letzte;
      if (aus || !ich || l.phase !== "fahrt" || l.ende || besitzer(k, l.beginnt) !== ich) return;
      const t = Math.max(uhr.tick(), (l.letzter?.[ich] ?? -1));
      zug(`${ich}${t}:W${k}`);
      ton("klack");
    }

    function loksBauen(plan) {
      lokSchicht.innerHTML = "";
      lokEl = plan.loks.map((lok) => {
        const e = el("span", `zw-ws-lok ist-f${lok.farbe}`, FARBEN[lok.farbe].zeichen);
        e.hidden = true;
        lokSchicht.append(e);
        return e;
      });
    }

    function malen(s, plan, bruch, l) {
      const ich = letzte?.ich;
      linien.forEach((x, i) => {
        const wann = STUECKE[i][2];
        x.classList.toggle("ist-an", !wann || s.weichen[wann[0]] === wann[1]);
      });
      weichen.forEach((w, k) => {
        const wer = besitzer(k, l.beginnt);
        w.className = `zw-ws-weiche ist-${wer}${s.weichen[k] ? " ist-rechts" : " ist-links"}`;
        w.textContent = s.weichen[k] ? "↘" : "↙";
        w.disabled = !(l.phase === "fahrt" && ich === wer && !letzte?.aus);
        w.setAttribute("aria-label", `${k === 0 ? "Obere Weiche" : k === 1 ? "Linke untere Weiche" : "Rechte untere Weiche"}: nach ${s.weichen[k] ? "rechts" : "links"}`);
        // Leicht und einfach: Die eigene Weiche leuchtet, wenn sie für die
        // nächste Lok falsch steht.
        const b = plan.grad <= 1 && l.phase === "fahrt" && ich === wer ? bedarf(plan, s, k) : null;
        w.classList.toggle("ist-ruf", Boolean(b && b.soll !== s.weichen[k] && s.tick >= plan.loks[b.i].start - VORLAUF));
      });
      plan.loks.forEach((lok, i) => {
        const z = s.loks[i];
        const e = lokEl[i];
        const sichtbar = s.tick >= lok.start - VORLAUF && (z.da === null || s.tick - z.da < 14);
        e.hidden = !sichtbar;
        if (!sichtbar) return;
        const p = z.bahnhof !== null || s.tick < lok.start ? z.p : Math.min(LANG, z.p + plan.tempo * bruch);
        const [x, y] = ort(z, p, s.weichen);
        e.style.left = `${x}%`;
        e.style.top = `${(y / 120) * 100}%`;
        e.classList.toggle("ist-wartet", s.tick < lok.start);
        e.classList.toggle("ist-richtig", z.bahnhof !== null && z.bahnhof === lok.farbe);
        e.classList.toggle("ist-falsch", z.bahnhof !== null && z.bahnhof !== lok.farbe);
      });
      const angekommen = s.loks.filter((z) => z.bahnhof !== null).length;
      herzen.textContent = "❤️".repeat(Math.max(0, s.herzen)) + "\u{1F90D}".repeat(Math.max(0, HERZEN - s.herzen));
      herzen.setAttribute("aria-label", `${s.herzen} von ${HERZEN} Herzen`);
      loksZahl.textContent = `\u{1F682} ${angekommen} / ${plan.loks.length}`;
      sterne.textContent = `⭐ ${s.richtig}`;
      if (s.herzen < gezeigt.herzen) { ton("treffer"); netz.classList.remove("ist-rums"); void netz.offsetWidth; netz.classList.add("ist-rums"); }
      if (s.richtig > gezeigt.richtig) ton("da");
      gezeigt.herzen = s.herzen;
      gezeigt.richtig = s.richtig;
    }

    function schleife() {
      lauf = 0;
      if (!letzte) return;
      const { lage: l } = letzte;
      if (l.phase !== "fahrt") return;
      const jetzt = uhr.tick();
      const s = simuliere(l.plan, l.aktionen, jetzt);
      malen(s, l.plan, s.ende ? 0 : uhr.bruch(), l);
      // Ist es aus – und kommt keine Weiche mehr, die früher gestellt
      // wurde –, sagt dieses Gerät es allen.
      if (s.ende && jetzt >= (l.letzterTick ?? -1) && endeGeschickt !== l.zahl) {
        endeGeschickt = l.zahl;
        zug(`E${s.endTick}`);
      }
      lauf = window.requestAnimationFrame(schleife);
    }

    function zeichne(args) {
      const { lage: l, nr, aus, ich, modus, saat } = args;
      letzte = args;
      uhr = uhrVon(modus, nr, saat);
      const schluessel = `${modus}|${nr}|${saat}`;
      if (schluessel !== planFuer) { loksBauen(l.plan); planFuer = schluessel; gezeigt = { herzen: HERZEN, richtig: 0 }; endeGeschickt = -1; }
      if (l.gestartet) uhr.stellen(l.letzterTick ?? -1);
      const fahrt = l.phase === "fahrt";
      los.hidden = l.phase !== "bereit";
      los.disabled = Boolean(aus || !ich);
      knoten.dataset.zuege = String(l.zahl);
      knoten.dataset.phase = l.phase;
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.classList.toggle("ist-geschafft", l.ende === "g");
      if (fahrt && !ruhig()) { if (!lauf) lauf = window.requestAnimationFrame(schleife); } else {
        if (lauf) { window.cancelAnimationFrame(lauf); lauf = 0; }
        malen(l.phase === "ende" ? l.stand : fahrt ? simuliere(l.plan, l.aktionen, uhr.tick()) : l.stand, l.plan, 0, l);
        if (fahrt && ruhig()) window.setTimeout(() => { if (letzte === args) zeichne(args); }, 250);
      }
    }

    return {
      knoten,
      zeichne,
      fokus: () => (!los.hidden ? los : weichen.find((w) => !w.disabled) || los).focus({ preventScroll: true }),
    };
  }

  // Zu zweit kommen mit jeder zweiten Partie mehr Loks, und schneller.
  function neuePartie(stufe, { nr = 0 } = {}) {
    const grad = stufe ? 0 : Math.min(3, Math.floor((Number(nr) || 0) / 2));
    return { saat: ((grad << 29) | Math.floor(Math.random() * 0x1fffffff)) >>> 0 };
  }

  Z.starte({
    id: "weichensteller",
    titel: "Weichensteller",
    seite: "weichensteller",
    unter: "Zusammen! Die Loks kommen aus dem Tunnel – stellt die Weichen, damit jede in den Bahnhof ihrer Farbe fährt. Eine stellt die obere Weiche, die andere die unteren.",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Sechs Loks, gemächlich" },
      einfach: { name: "Einfach", sterne: 1, satz: "Acht Loks" },
      mittel: { name: "Mittel", sterne: 2, satz: "Zehn Loks, schneller" },
      schwer: { name: "Schwer", sterne: 3, satz: "Zwölf Loks, dicht hintereinander" },
    },
    texte: { start: "tippt «Los!»", geschafft: "Geschafft – alle Loks sind angekommen!", verpasst: "Die Herzen sind weg – nicht geschafft." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie,
    vorlesen: (b) => (b.lage.ende ? "" : `Noch ${b.lage.stand.herzen} Herzen, ${b.lage.stand.richtig} Loks im richtigen Bahnhof.`),
    fuerPruefung: { planVon, simuliere, fahrt, gradVon, bedarf, besitzer, HERZEN, MAX_TICK, L0, L1, L2, FARBEN },
  });
})();
