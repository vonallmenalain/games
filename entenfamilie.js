/*
 * entenfamilie.js – Entenfamilie.
 * ---------------------------------------------------------------------------
 * Eine Entenmutter zieht mit ihren Küken zum See, und dazwischen liegen
 * Flüsse voller Boote: Ruderboote, Kanus, Flösse, Motorboote, ein Dampfer.
 * Von oben gesehen, Fluss um Fluss nach oben.
 *
 * Es gibt eine Regel: Halten heisst schwimmen, Loslassen heisst warten. Die
 * Mutter schwimmt geradeaus übers Wasser, die Küken hinter ihr her, jedes
 * dem vor ihm nach. Bleibt sie stehen, rücken die Küken zu ihr auf; schwimmt
 * sie wieder los, ziehen sie sich erst nach und nach wieder auseinander, wie
 * eine Ziehharmonika. Die Boote kreuzen in Bahnen, jede Bahn in ihrem Tempo
 * und ihrer Richtung. Wird die Mutter oder ein Küken getroffen, ist die Runde
 * vorbei. Sicher ist nur das Ufer – und die Seerosenfelder zwischen manchen
 * Bahnen.
 *
 * Und das ist der Kniff: Jedes Ufer bringt ein Küken mehr. Die Kette wird
 * länger, und eine Lücke, die eben noch reichte, reicht nicht mehr – denn
 * eine Bahn ist erst frei, wenn auch das letzte Küken drüben ist. Schwerer
 * wird es also durch den eigenen Erfolg, ohne neue Regel. Dazu kommen nach
 * oben mehr Bahnen, schnellere Boote, und die Seerosen werden seltener.
 *
 * Gezählt wird je Fluss: so viele Punkte, wie Küken drüben ankommen. Wer
 * den ganzen Fluss in einem Zug quert – ohne anzuhalten, solange eine Ente
 * im Wasser ist –, bekommt sie doppelt. Die Runde dauert, bis die Sonne
 * untergeht (DAUER), oder bis ein Boot trifft.
 *
 * Wie die Flüsse liegen (Bahnen, Seerosen, Breite), steht fest: Fluss n ist
 * in jeder Runde gleich breit. Die Boote kommen aus dem Zufall (zufall.js):
 * je Bahn Tempo, Richtung, Boote und Lücken – ohne Turnier jedes Mal andere,
 * im Turnier für alle im selben Versuch dieselben.
 *
 * Schaffbar ist jeder Fluss, denn er hat eine grüne Welle: Alle Bahnen eines
 * Flusses wiederholen sich im selben Takt (takt), und einmal je Takt liegt
 * in jeder Bahn genau dann eine Lücke vor der Familie, wenn sie bei vollem
 * Tempo dort ankommt – vom ersten Schritt ins Wasser bis das letzte Küken
 * drüben ist. Wer die Welle erwischt, quert in einem Zug. Die übrigen Lücken
 * sind zufällig: Manche reichen, manche nur für die halbe Familie.
 *
 * Gerechnet wird in Metern: x quer (die Familie schwimmt bei x = 0), y nach
 * oben. Die Boote hängen allein an der Uhr der Runde (state.uhr) – wo eines
 * ist, folgt aus der Zeit, nicht aus dem Bild davor. So stehen sie beim
 * Zuschauen genau dort, wo sie damals waren.
 *
 * Die Gegner (geist.js) schwimmen als Mutterente aus Licht neben der Familie
 * mit – so weit, wie sie damals zu dieser Zeit waren (a: y in Dezimetern,
 * c: wie viele Küken). Und die besten Läufe lassen sich anschauen
 * (?zuschauen=, geist.js): mit derselben Saat dieselben Boote.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "ducks") return;

  const host = document.querySelector("#ef-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: nur die Boote. Wellen, Spritzer und Blüten nehmen
  // Math.random oder feste Zahlen.
  const zufall = window.LernappZufall?.fuer?.("duckCrossing") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten
  const DAUER = 90;                // Sekunden, bis die Sonne untergeht
  const BAHN_W = 2;                // so breit ist eine Bahn
  const SEEROSEN_W = 1.6;          // so breit ein Seerosenfeld
  const SICHT_H = 12.5;            // so viel Welt steht in der Höhe im Bild …
  const SICHT_W = 9;               // … und quer mindestens so viel
  const VORAUS = 10;               // weiter weg verschwinden die Boote im Dunst

  // Die Familie.
  const V_ENTE = 2.6;              // so schnell schwimmt die Mutter (m/s)
  const V_KUEKEN = 3.4;            // so schnell holt ein Küken auf
  const MUTTER_R = 0.36;           // so gross sind sie (Halbmesser)
  const KUEKEN_R = 0.25;
  const ABSTAND = 0.7;             // so weit schwimmt ein Küken hinter dem vor ihm
  const ABSTAND_ENG = 0.5;         // so eng rücken sie auf, wenn die Mutter wartet
  const KUEKEN_START = 2;
  const KUEKEN_MAX = 8;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.entenfamilie", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const TAU = Math.PI * 2;

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Wie viele Bahnen Fluss n hat und wie viele höchstens ohne Seerosen
  // dazwischen aufeinander folgen.
  const bahnenBei = (n) => Math.min(6, 2 + Math.floor((n + 1) / 2));
  const gruppeBei = (n) => (n < 2 ? 1 : n < 5 ? 2 : 3);
  // Wie schwer Fluss n ist (0 … gegen 1).
  const schwerBei = (n) => 1 - Math.exp(-n / 6);
  // Wie viele Küken die Familie auf Fluss n hat.
  const kuekenBei = (n) => Math.min(KUEKEN_MAX, KUEKEN_START + n);
  // Wie lang die Familie in voller Fahrt ist: von der Nase der Mutter bis
  // zum Schwanz des letzten Kükens.
  const ketteBei = (k) => MUTTER_R + 0.12 + k * ABSTAND + KUEKEN_R;
  // So breit ist das Ufer vor einem Fluss: Die ganze Familie passt darauf,
  // auch in voller Fahrt – wer drüben ankommt, steht noch nicht im nächsten.
  const ufer = (k) => Math.max(2.6, ketteBei(k) + 0.8);

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts gedrückt), "spiel", "zuschauen", "ende"
  // schritt: "unterwegs", "erwischt"
  const state = {
    phase: "bereit",
    schritt: "unterwegs",
    punkte: 0,
    fluesse: [],           // die Flüsse, nach oben
    fluss: 0,              // auf welchen Fluss die Familie zuhält
    geschafft: 0,          // so viele Flüsse sind gequert
    enten: [],             // { y, v } – die Mutter vorn, dann die Küken
    neu: [],               // Küken, die gerade am Ufer dazukommen (fürs Bild)
    inEinemZug: true,      // noch nicht angehalten, seit die erste im Wasser ist
    imWasser: false,
    zuege: 0,              // so viele Flüsse in einem Zug
    getroffen: -1,         // welche Ente das Boot traf
    uhr: 0,                // die Zeit, nach der die Boote fahren
    zeit: 0,
    seitStart: 0,
    camY: 0,
    wellen: [],
    spritzer: [],
    schriften: [],
    stoss: 0,
    endeZeit: 0,
    klangZeit: -9,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gedrueckt = false;
  let gegner = null;
  let zuschauer = null;
  // Die Vögel am Ufer (klang.js): eine leise Schleife, solange die Runde läuft.
  let ambient = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, s: 30, mx: 0, my: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  const zuletzt = new Map();
  function ton(id, o = {}, pause = 80) {
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }
  function ambientAn() {
    ambient = klang()?.kulisse?.("entenfamilie.ambient") || null;
    ambient?.laut(0.7);
  }
  function ambientAus() {
    ambient?.stop();
    ambient = null;
  }

  // ---------------------------------------------------------------------------
  // Die Flüsse
  // ---------------------------------------------------------------------------
  /*
   * Ein Fluss beginnt bei y0 (am oberen Rand des Ufers darunter) und hat
   * Reihen nach oben: Bahnen und Seerosenfelder. Danach kommt das Ufer, dann
   * der nächste Fluss. Wie die Reihen liegen, hängt nur an n; die Boote
   * würfelt jede Bahn für sich, immer gleich viele Zahlen (ZAHLEN_JE_BAHN),
   * dazu der Fluss eine für seine Welle.
   *
   * Eine Bahn: Richtung dir (+1 nach rechts), Tempo v, und ein Muster aus
   * Booten, das sich mit der Periode P = v · takt / wdh wiederholt – wdh Mal
   * je Takt: boote [{ x0, lang, art }], x0 die Mitte zur Zeit 0. Die Welle: Die Mutter erreicht
   * das Wasser zur Zeit welle + j · takt bei vollem Tempo; für jede Bahn ist
   * ausgerechnet, wann die Familie sie belegt (vom Kopf der Mutter bis zum
   * Schwanz des letzten Kükens), und genau dann steht dort die grosse Lücke
   * – mit SPIEL Metern Luft davor und dahinter.
   */
  const ZAHLEN_JE_BAHN = 12;
  const ARTEN = [
    { art: "ruder", lang: [2.4, 2.8] },
    { art: "kanu", lang: [3.2, 3.8] },
    { art: "floss", lang: [3.6, 4.6] },
    { art: "motor", lang: [3.8, 4.8] },
    { art: "dampfer", lang: [7.5, 9] },
  ];
  const SPIEL = [1.1, 0.45];       // Luft vor und hinter der Familie in der Welle (m), anfangs, hinten
  const TAKT_MAX = 8.5;            // so lang braucht eine Bahn höchstens für ihr Muster (s)

  function neuerFluss(n) {
    const vor = state.fluesse[n - 1];
    const k = kuekenBei(n);
    const y0 = vor ? vor.y1 + ufer(k) : 0;
    const anzahl = bahnenBei(n);
    const gruppe = gruppeBei(n);
    const schwer = schwerBei(n);
    const lang = ketteBei(k);
    const spiel = lerp(SPIEL[0], SPIEL[1], schwer);
    const reihen = [];
    let y = y0;
    let inGruppe = 0;
    // Erst die Reihen und für jede Bahn ihr Muster ohne Takt.
    for (let i = 0; i < anzahl; i += 1) {
      if (inGruppe === gruppe) {
        reihen.push({ art: "seerosen", y0: y, y1: y + SEEROSEN_W });
        y += SEEROSEN_W;
        inGruppe = 0;
      }
      const z = [];
      for (let j = 0; j < ZAHLEN_JE_BAHN; j += 1) z.push(zufall.zahl());
      const dir = (i + n) % 2 === 0 ? (z[0] < 0.5 ? 1 : -1) : (z[0] < 0.5 ? -1 : 1);
      const v = Math.min(5, (1.4 + 0.2 * n) * lerp(0.85, 1.25, z[1]));
      // So lange belegt die Familie die Bahn bei x = 0 – so weit fährt ein
      // Boot in der Zeit; dazu ihre Breite und das Spiel davor und danach.
      const belegt = (BAHN_W + lang) / V_ENTE;
      const gross = v * belegt + 2 * (MUTTER_R + spiel);
      // Wenige Boote je Bahn – sonst würde der Takt lang: früh eines oder
      // zwei, später zwei oder drei.
      const viele = (n < 3 ? 1 : 2) + Math.floor(z[2] * 2);
      const boote = [];
      for (let b = 0; b < viele; b += 1) {
        const arten = n >= 2 && v < 3.2 ? ARTEN : ARTEN.slice(0, 4);
        const a = arten[Math.floor(z[3 + b] * arten.length)];
        boote.push({ lang: lerp(a.lang[0], a.lang[1], z[6 + b]), art: a.art, farbe: Math.floor(hash01(n * 31 + i * 7 + b) * 5), x0: 0 });
      }
      // Die anderen Lücken: zufällig, manche reichen, manche nicht.
      const luecken = boote.slice(1).map((_, b) => gross * lerp(0.35, 1.1, z[9 + b]));
      reihen.push({ art: "bahn", y0: y, y1: y + BAHN_W, dir, v, boote, luecken, gross, P: 0 });
      y += BAHN_W;
      inGruppe += 1;
    }
    const bahnen = reihen.filter((r) => r.art === "bahn");
    // Wie lange eine Bahn für ihr Muster braucht. Eine langsame Bahn mit
    // vielen Booten bräuchte zu lange – sie fährt dann mit weniger.
    const natur = (r) => r.gross + r.boote.reduce((a, b) => a + b.lang, 0) + r.luecken.reduce((a, b) => a + b, 0);
    for (const r of bahnen) {
      while (r.boote.length > 1 && natur(r) / r.v > TAKT_MAX) { r.boote.pop(); r.luecken.pop(); }
    }
    // Der Takt: so lang, dass jede Bahn ihr Muster unterbringt. Eine
    // schnelle Bahn wiederholt ihres darin mehrmals (wdh).
    const mindest = Math.max(...bahnen.map((r) => natur(r) / r.v));
    const takt = mindest * lerp(1.05, 1.2, zufall.zahl());
    const welle = takt * zufall.zahl();
    for (const r of bahnen) {
      r.wdh = Math.max(1, Math.floor((r.v * takt) / natur(r)));
      r.P = (r.v * takt) / r.wdh;
      // Was der Takt mehr gibt, kommt zu gleichen Teilen in die kleinen Lücken.
      const summe = r.gross + r.boote.reduce((a, b) => a + b.lang, 0) + r.luecken.reduce((a, b) => a + b, 0);
      const extra = (r.P - summe) / Math.max(1, r.luecken.length);
      r.luecken = r.luecken.map((l) => l + extra);
      if (!r.luecken.length) r.gross += r.P - summe;
      // Wann die Familie mitten in dieser Bahn ist: Die Mutter erreicht das
      // Wasser zur Zeit welle, den Rand der Bahn (y0 − MUTTER_R) danach, und
      // das letzte Küken verlässt sie (BAHN_W + lang) / V_ENTE später.
      const tEin = welle + (r.y0 - MUTTER_R - (y0 - MUTTER_R)) / V_ENTE;
      const tMitte = tEin + (BAHN_W + lang) / (2 * V_ENTE);
      // Zu dieser Zeit liegt die grosse Lücke um x = 0. Die Boote folgen ihr
      // gegen die Fahrtrichtung: das erste dort, wo die Lücke endet.
      let x = r.gross / 2;
      r.boote.forEach((b, i) => {
        const mitte = x + b.lang / 2;
        // Zur Zeit tMitte steht es bei −dir · mitte (hinter der Lücke, aus
        // Sicht der Fahrt: Es kommt erst noch).
        b.x0 = -r.dir * mitte - r.dir * r.v * tMitte;
        x += b.lang + (r.luecken[i] || 0);
      });
    }
    return { n, y0, y1: y, reihen, kueken: k, takt, welle };
  }

  function fluesseBis(n) {
    while (state.fluesse.length <= n) state.fluesse.push(neuerFluss(state.fluesse.length));
  }

  // Wo die Boote einer Bahn zur Zeit t stehen: ihre Mitten, so oft
  // wiederholt, dass sie den sichtbaren Fluss füllen.
  function bootePos(bahn, t, rand = VORAUS + 6) {
    const raus = [];
    const P = bahn.P;
    for (const b of bahn.boote) {
      let x = (b.x0 + bahn.dir * bahn.v * t) % P;
      if (x < -P / 2) x += P;
      if (x >= P / 2) x -= P;
      for (let k = -3; k <= 3; k += 1) {
        const xx = x + k * P;
        if (Math.abs(xx) < rand + b.lang) raus.push({ x: xx, b });
      }
    }
    return raus;
  }

  // Ist bei x = 0 in dieser Bahn ein Boot, das eine Ente mit Halbmesser r
  // trifft?
  function trifftBoot(bahn, t, r) {
    for (const p of bootePos(bahn, t, 2)) {
      if (Math.abs(p.x) < p.b.lang / 2 + r - 0.05) return p;
    }
    return null;
  }

  // Die Reihe bei y, oder null (Ufer).
  function reiheBei(y) {
    for (const f of state.fluesse) {
      if (y < f.y0 || y >= f.y1) continue;
      for (const r of f.reihen) if (y >= r.y0 && y < r.y1) return r;
    }
    return null;
  }

  // Ob y im Wasser eines Flusses liegt.
  const imFluss = (y, f) => y >= f.y0 && y < f.y1;

  // Die gewürfelte Welt in Worten (für die Prüfung): die Bahnen der ersten
  // drei Flüsse.
  function weltText() {
    fluesseBis(2);
    return state.fluesse.slice(0, 3).map((f) => `${f.takt.toFixed(2)}/${f.welle.toFixed(2)} `
      + f.reihen.filter((r) => r.art === "bahn").map((r) => `${r.dir}:${r.v.toFixed(2)}:${r.P.toFixed(1)}`).join(",")).join(" | ");
  }

  // ---------------------------------------------------------------------------
  // Die Familie
  // ---------------------------------------------------------------------------
  function familieAufbauen(k) {
    const enten = [{ y: -1.1, v: 0, r: MUTTER_R }];
    for (let i = 0; i < k; i += 1) enten.push({ y: enten[i].y - (i === 0 ? ABSTAND + 0.12 : ABSTAND), v: 0, r: KUEKEN_R });
    state.enten = enten;
  }

  // Ein Schritt: Die Mutter schwimmt dy weit (beim Spielen V_ENTE · h,
  // solange gehalten wird); jedes Küken folgt dem vor ihm – mit ABSTAND,
  // solange das schwimmt, sonst rückt es auf.
  function familieSchritt(h, dy, e = state.enten) {
    const m = e[0];
    m.y += dy;
    m.v = dy / Math.max(h, 1e-6);
    for (let i = 1; i < e.length; i += 1) {
      const vor = e[i - 1];
      const ab = (i === 1 ? 0.12 : 0) + (vor.v > 0.2 ? ABSTAND : ABSTAND_ENG);
      const ziel = vor.y - ab;
      const alt = e[i].y;
      if (ziel > e[i].y) e[i].y = Math.min(ziel, e[i].y + V_KUEKEN * h);
      e[i].v = (e[i].y - alt) / Math.max(h, 1e-6);
    }
  }

  // Für die Prüfung und die Vorführung: Kommt die Familie heil über den
  // Fluss, wenn sie jetzt noch warten Sekunden wartet und dann ohne Halt
  // schwimmt – mit luft Metern Abstand zu jedem Boot? Gerechnet auf einer
  // Kopie, in Schritten von h.
  function querungOk(warten, h = 1 / 120, luft = 0.3) {
    const f = state.fluesse[state.fluss];
    const e = state.enten.map((d) => ({ y: d.y, v: d.v, r: d.r }));
    const t0 = state.uhr;
    for (let t = t0; t < t0 + warten + 40; t += h) {
      familieSchritt(h, t >= t0 + warten ? V_ENTE * h : 0, e);
      for (const d of e) {
        const r = reiheBei(d.y);
        if (r?.art === "bahn" && trifftBoot(r, t + h, d.r + luft)) return false;
        // Auch wer gleich in eine Bahn kommt, braucht dort Luft.
        const vorn = reiheBei(d.y + d.r + luft);
        if (vorn?.art === "bahn" && vorn !== r && trifftBoot(vorn, t + h, d.r + luft)) return false;
      }
      const letzte = e[e.length - 1];
      if (letzte.y - letzte.r >= f.y1) return true;
    }
    return false;
  }

  // Die kürzeste Wartezeit (bis bis), nach der querungOk gilt – oder null.
  function wartenBisWelle(bis = 20, schritt = 0.05) {
    for (let w = 0; w <= bis; w += schritt) if (querungOk(w)) return w;
    return null;
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function physik(h) {
    state.uhr += h;
    state.seitStart += h;
    if (state.schritt !== "unterwegs") return;
    familieSchritt(h, gedrueckt ? V_ENTE * h : 0);
    const e = state.enten;
    // Ein Boot?
    for (let i = 0; i < e.length; i += 1) {
      const r = reiheBei(e[i].y);
      if (r?.art !== "bahn") continue;
      if (trifftBoot(r, state.uhr, e[i].r)) { erwischt(i); return; }
    }
    wasserUndUfer();
  }

  // Im Wasser, angehalten, am Ufer: dasselbe beim Spielen und beim Zuschauen.
  function wasserUndUfer() {
    const e = state.enten;
    const f = state.fluesse[state.fluss];
    // Im Wasser – und angehalten?
    const nass = e.some((d) => imFluss(d.y, f));
    if (nass && !state.imWasser) { state.imWasser = true; state.inEinemZug = true; }
    if (nass && e[0].v < 0.05) state.inEinemZug = false;
    // Alle drüben: Der Fluss ist geschafft.
    const letzte = e[e.length - 1];
    if (state.imWasser && letzte.y - letzte.r >= f.y1) flussGeschafft();
  }

  function flussGeschafft() {
    const f = state.fluesse[state.fluss];
    const k = state.enten.length - 1;
    const zug = state.inEinemZug;
    const plus = k * (zug ? 2 : 1);
    if (zug) state.zuege += 1;
    state.geschafft += 1;
    if (state.phase === "spiel") state.punkte += plus;
    shell.setCount(state.punkte);
    const y = state.enten[0].y + 1.3;
    schrift(`+${plus}`, 0, y, zug ? "#ffd23f" : "#ffffff", 26, 1.6);
    if (zug) schrift("In einem Zug! ×2", 0, y + 1, "#ffd23f", 17, 1.6);
    ton(zug ? "perfekt" : "punkt", { laut: 0.8 }, 200);
    if (state.phase === "spiel") kids()?.vibrate?.(zug ? [10, 30, 14] : 12);
    // Ein Küken mehr: Es wartet im Schilf und hüpft hinten an.
    state.fluss += 1;
    state.imWasser = false;
    state.inEinemZug = true;
    fluesseBis(state.fluss + 2);
    const soll = kuekenBei(state.fluss);
    while (state.enten.length - 1 < soll) {
      const hinten = state.enten[state.enten.length - 1];
      const neu = { y: Math.max(f.y1 + 0.2, hinten.y - ABSTAND), v: 0, r: KUEKEN_R, auf: 0 };
      state.enten.push(neu);
      state.neu.push({ ente: neu, alter: 0 });
      ton("entenfamilie.piep", { laut: 0.8, verzoegerung: 0.15 }, 150);
    }
  }

  // Ein Boot hat eine Ente erwischt: Spritzer, und die Runde ist vorbei.
  function erwischt(i) {
    state.schritt = "erwischt";
    state.getroffen = i;
    state.endeZeit = state.zeit;
    state.stoss = 1;
    const d = state.enten[i];
    spritzerBei(0, d.y, 22);
    schrift(i === 0 ? "Die Mutter!" : "Erwischt!", 0, d.y + 1.4, "#ff7a6b", 24, 2);
    ton("entenfamilie.platsch", { laut: 1 });
    if (state.phase === "spiel") {
      ton("fehler", { verzoegerung: 0.2 }, 300);
      kids()?.vibrate?.([30, 40, 60]);
      shell.stopClock?.();
      ambientAus();
      stepTimer = window.setTimeout(finish, 1500);
    }
  }

  function takt(dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.4);
    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.phase === "spiel") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n && state.phase === "spiel"; i += 1) physik(dt / n);
    } else if (state.phase === "bereit") {
      // Vor dem ersten Druck fahren die Boote schon – im Live-Modus nach der
      // Uhr des Abends, damit sie auf jedem Gerät gleich stehen.
      const live = shell.live ? window.LernappLiveSpiel : null;
      state.uhr = live ? live.zeit() / 1000 : state.uhr + dt;
    } else if (state.schritt === "erwischt") {
      state.uhr += dt;
    }
    nebenbei(dt);
    kameraTakt(dt);
    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(state.enten[0].y * 10), b: gedrueckt ? 1 : 0, c: state.enten.length - 1 });
    }
  }

  // Wellen hinter den schwimmenden Enten, Spritzer, Schriften.
  function nebenbei(dt) {
    for (const d of state.enten) {
      d.wellenKonto = (d.wellenKonto || 0) + (d.v > 0.3 && reiheBei(d.y) ? dt * 7 : 0);
      while (d.wellenKonto >= 1) {
        d.wellenKonto -= 1;
        state.wellen.push({ y: d.y - d.r, r: d.r, alter: 0, dauer: 1.1 });
      }
    }
    if (state.wellen.length > 120) state.wellen.splice(0, state.wellen.length - 120);
    for (let i = state.wellen.length - 1; i >= 0; i -= 1) {
      state.wellen[i].alter += dt;
      if (state.wellen[i].alter > state.wellen[i].dauer) state.wellen.splice(i, 1);
    }
    for (let i = state.spritzer.length - 1; i >= 0; i -= 1) {
      const t = state.spritzer[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vx *= 1 - 2 * dt;
      t.vy *= 1 - 2 * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.spritzer.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    for (let i = state.neu.length - 1; i >= 0; i -= 1) {
      state.neu[i].alter += dt;
      if (state.neu[i].alter > 0.6) state.neu.splice(i, 1);
    }
  }

  // Die Kamera: Sie folgt der Mutter, mit mehr Platz vor ihr als hinter ihr –
  // wer schwimmt, will sehen, was kommt.
  function kameraZiel() {
    return (state.enten[0]?.y || 0) + SICHT_H * 0.18;
  }

  function kameraTakt(dt) {
    const ziel = kameraZiel();
    const k = state.zeit < 0.05 ? 1 : 1 - Math.exp(-dt * 2.6);
    state.camY += (ziel - state.camY) * k;
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  function spritzerBei(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * TAU;
      const v = 1 + Math.random() * 3.5;
      state.spritzer.push({ x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.06 + Math.random() * 0.12, leben: 0.5 + Math.random() * 0.5, max: 1 });
    }
  }

  function schrift(text, x, y, farbe, gross, dauer = 1.4) {
    state.schriften.push({ text, x, y, farbe, gross, leben: dauer, max: dauer });
    if (state.schriften.length > 5) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "ef-platz");
    feld = shell.el("div", "ef-feld");
    canvas = document.createElement("canvas");
    canvas.className = "ef-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    // Der Hinweis vor dem ersten Druck: ein Ring, der sich füllt – halten,
    // nicht tippen.
    const tipp = shell.el("span", "ef-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "ef-tipp-fuell" },
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
    platz.append(feld);
    return platz;
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
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
  }

  // Der Massstab: SICHT_H Meter in der Höhe, quer mindestens SICHT_W.
  function kamera() {
    const nutzH = view.cssH - view.frei;
    view.s = Math.min(nutzH / SICHT_H, view.cssW / SICHT_W);
    view.mx = view.cssW / 2;
    view.my = view.frei + nutzH / 2;
  }
  const bx = (x) => view.mx + x * view.s;
  const by = (y) => view.my - (y - state.camY) * view.s;
  const wackel = () => (ruhig() ? 0 : Math.sin(state.zeit * 61) * 4 * state.stoss);

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Das Licht wandert mit der Uhr: Nachmittag, goldene Stunde, Abendrot.
  function abend() {
    if (state.phase === "bereit") return 0;
    return clamp(state.seitStart / DAUER, 0, 1);
  }

  function zeichnen() {
    if (!g) return;
    kamera();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, wackel() * view.dpr);
    const W = view.cssW;
    const H = view.cssH;
    // Erst alles Land, dann die Flüsse darüber.
    g.fillStyle = "#4f8a3a";
    g.fillRect(-10, -10, W + 20, H + 20);
    zeichneWiese();
    for (const f of state.fluesse) {
      if (by(f.y1) > H + 40 || by(f.y0) < -40) continue;
      zeichneFluss(f);
    }
    zeichneWellen();
    zeichneGeister();
    zeichneFamilie();
    zeichneSpritzer();
    for (const f of state.fluesse) {
      if (by(f.y1) > H + 40 || by(f.y0) < -40) continue;
      zeichneBoote(f);
    }
    zeichneDunst();
    zeichneLicht();
    zeichneSchriften();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneAnzeige();
  }

  // Die Wiese: Grasbüschel und Blumen an festen Plätzen.
  function zeichneWiese() {
    const s = view.s;
    const yUnten = state.camY - view.cssH / s;
    const yOben = state.camY + view.cssH / s;
    const xRand = view.cssW / s / 2 + 1;
    for (let y = Math.floor(yUnten); y < yOben; y += 1) {
      for (let j = 0; j < 4; j += 1) {
        const h = (k) => hash01(y * 13.1 + j * 7.7 + k * 3.3);
        const x = (h(1) - 0.5) * 2 * xRand;
        if (reiheBei(y + h(2))) continue;
        const X = bx(x);
        const Y = by(y + h(2));
        if (h(3) < 0.2) {
          g.fillStyle = ["#ffffff", "#ffd23f", "#ff9fb8"][Math.floor(h(4) * 3)];
          g.beginPath();
          g.arc(X, Y, Math.max(1.2, 0.06 * s), 0, TAU);
          g.fill();
        } else {
          g.strokeStyle = "rgba(30, 70, 25, 0.55)";
          g.lineWidth = Math.max(1, 0.04 * s);
          g.beginPath();
          g.moveTo(X, Y);
          g.lineTo(X - 0.08 * s, Y - 0.22 * s);
          g.moveTo(X, Y);
          g.lineTo(X + 0.06 * s, Y - 0.25 * s);
          g.stroke();
        }
      }
    }
  }

  // Ein Fluss: Wasser, Ufersaum mit Schilf, die Bahnen fein gestrichelt, die
  // Seerosenfelder mit Blättern und Blüten.
  function zeichneFluss(f) {
    const W = view.cssW;
    const s = view.s;
    const Y0 = by(f.y0);
    const Y1 = by(f.y1);
    // Das Wasser, zur Mitte dunkler.
    const wasser = g.createLinearGradient(0, Y1, 0, Y0);
    wasser.addColorStop(0, "#3d8fb8");
    wasser.addColorStop(0.5, "#2b6f99");
    wasser.addColorStop(1, "#3d8fb8");
    g.fillStyle = wasser;
    g.fillRect(-10, Y1, W + 20, Y0 - Y1);
    // Der Ufersaum: Sand und Schilf.
    for (const [y, seite] of [[f.y0, 1], [f.y1, -1]]) {
      const Y = by(y);
      g.fillStyle = "#c9b27a";
      g.fillRect(-10, seite > 0 ? Y : Y - 0.18 * s, W + 20, 0.18 * s);
      for (let i = 0; i < 46; i += 1) {
        const h = hash01(f.n * 97 + i * 5.3 + seite * 11);
        if (h > 0.55) continue;
        const x = (i / 46 - 0.5) * (W / s + 2);
        const X = bx(x);
        g.strokeStyle = "#3f6f2a";
        g.lineWidth = Math.max(1, 0.05 * s);
        g.beginPath();
        g.moveTo(X, Y);
        g.lineTo(X + (h - 0.3) * 0.3 * s, Y + seite * 0.42 * s);
        g.stroke();
        g.fillStyle = "#6b4a2a";
        g.beginPath();
        g.ellipse(X + (h - 0.3) * 0.3 * s, Y + seite * 0.42 * s, Math.max(1, 0.04 * s), Math.max(2, 0.1 * s), 0, 0, TAU);
        g.fill();
      }
    }
    for (const r of f.reihen) {
      if (r.art === "seerosen") {
        // Ein grüner Streifen voller Blätter.
        g.fillStyle = "rgba(60, 120, 70, 0.35)";
        g.fillRect(-10, by(r.y1), W + 20, (r.y1 - r.y0) * s);
        for (let i = 0; i < 40; i += 1) {
          const h = (k) => hash01(f.n * 131 + r.y0 * 17 + i * 3.7 + k);
          const x = (i / 40 - 0.5) * (W / s + 2) + (h(1) - 0.5) * 0.4;
          const y = lerp(r.y0 + 0.3, r.y1 - 0.3, h(2));
          const rr = (0.22 + h(3) * 0.18) * s;
          g.fillStyle = h(4) < 0.5 ? "#3f9a4a" : "#57b05a";
          g.beginPath();
          g.moveTo(bx(x), by(y));
          g.arc(bx(x), by(y), rr, h(5) * TAU + 0.35, h(5) * TAU + TAU - 0.05);
          g.closePath();
          g.fill();
          if (h(6) < 0.18) {
            g.fillStyle = "#ffd6e6";
            g.beginPath();
            g.arc(bx(x), by(y), rr * 0.35, 0, TAU);
            g.fill();
          }
        }
      } else {
        // Die Bahn: oben ein feiner Strich aus Bojen.
        if (r.y1 < f.y1) {
          g.fillStyle = "rgba(255, 255, 255, 0.28)";
          for (let x = -Math.ceil(W / s / 2); x <= W / s / 2; x += 1.6) {
            g.beginPath();
            g.arc(bx(x), by(r.y1), Math.max(1, 0.05 * s), 0, TAU);
            g.fill();
          }
        }
        // Glitzern in Fahrtrichtung.
        g.strokeStyle = "rgba(255, 255, 255, 0.08)";
        g.lineWidth = Math.max(1, 0.04 * s);
        for (let i = 0; i < 10; i += 1) {
          const h = hash01(f.n * 7 + r.y0 * 3 + i);
          const lauf = (((h * 40 + state.uhr * r.v * 0.35 * r.dir) % 40) + 40) % 40 - 20;
          const y = lerp(r.y0 + 0.2, r.y1 - 0.2, hash01(i * 3.3 + r.y0));
          g.beginPath();
          g.moveTo(bx(lauf), by(y));
          g.lineTo(bx(lauf + 0.8), by(y));
          g.stroke();
        }
      }
    }
  }

  // Die Boote einer Bahn, von oben: Rumpf, Deck, je nach Art Ruder,
  // Stämme, Kabine oder Schaufelrad – und ihre Bugwelle.
  const BOOTFARBEN = ["#c2492f", "#2f6fc2", "#e2b33a", "#2f9c6f", "#7b4fc2"];
  function zeichneBoote(f) {
    const s = view.s;
    for (const r of f.reihen) {
      if (r.art !== "bahn") continue;
      const yc = (r.y0 + r.y1) / 2;
      const Y = by(yc);
      for (const p of bootePos(r, state.uhr)) {
        const b = p.b;
        const X = bx(p.x);
        const L = b.lang * s;
        if (X + L < -20 || X - L > view.cssW + 20) continue;
        const B = (b.art === "dampfer" ? 1.5 : b.art === "floss" ? 1.4 : b.art === "kanu" ? 0.7 : 1.05) * s;
        g.save();
        g.translate(X, Y);
        if (r.dir < 0) g.scale(-1, 1);
        // Die Bugwelle hinter und neben dem Boot.
        g.strokeStyle = "rgba(255, 255, 255, 0.45)";
        g.lineWidth = Math.max(1, 0.06 * s);
        g.beginPath();
        g.moveTo(L / 2, 0);
        g.lineTo(-L / 2 - 0.9 * s, -B * 0.85);
        g.moveTo(L / 2, 0);
        g.lineTo(-L / 2 - 0.9 * s, B * 0.85);
        g.stroke();
        if (b.art === "floss") {
          // Ein Floss: Stämme nebeneinander.
          for (let i = 0; i < 4; i += 1) {
            g.fillStyle = i % 2 ? "#8a5a32" : "#9c6a3c";
            g.fillRect(-L / 2, -B / 2 + (i * B) / 4, L, B / 4 - 1);
          }
          g.fillStyle = "#5b3a20";
          g.fillRect(-L / 2 + L * 0.15, -B / 2, 0.12 * s, B);
          g.fillRect(L / 2 - L * 0.2, -B / 2, 0.12 * s, B);
        } else {
          // Ein Rumpf mit spitzem Bug.
          const farbe = b.art === "dampfer" ? "#f4f1ea" : b.art === "motor" ? "#f4f1ea" : BOOTFARBEN[b.farbe];
          g.fillStyle = farbe;
          g.beginPath();
          g.moveTo(L / 2, 0);
          g.quadraticCurveTo(L * 0.3, -B / 2, 0, -B / 2);
          g.lineTo(-L / 2 + 0.2 * s, -B / 2);
          g.quadraticCurveTo(-L / 2, -B / 2, -L / 2, -B * 0.3);
          g.lineTo(-L / 2, B * 0.3);
          g.quadraticCurveTo(-L / 2, B / 2, -L / 2 + 0.2 * s, B / 2);
          g.lineTo(0, B / 2);
          g.quadraticCurveTo(L * 0.3, B / 2, L / 2, 0);
          g.fill();
          g.strokeStyle = "rgba(0, 0, 0, 0.25)";
          g.lineWidth = Math.max(1, 0.05 * s);
          g.stroke();
          if (b.art === "ruder" || b.art === "kanu") {
            g.fillStyle = "#6b4a2a";
            g.fillRect(-L * 0.3, -B * 0.32, L * 0.55, B * 0.64);
            // Ruder oder Paddel, im Takt.
            const schlag = Math.sin(state.uhr * (b.art === "kanu" ? 7 : 5) + b.mitte) * 0.35;
            g.strokeStyle = "#e9d7b0";
            g.lineWidth = Math.max(1.5, 0.07 * s);
            g.beginPath();
            g.moveTo(0, -B * 0.3);
            g.lineTo(-schlag * s, -B * 0.3 - 0.75 * s);
            g.moveTo(0, B * 0.3);
            g.lineTo(-schlag * s, B * 0.3 + 0.75 * s);
            g.stroke();
            g.fillStyle = "#ffd6a0";
            g.beginPath();
            g.arc(0, 0, 0.18 * s, 0, TAU);
            g.fill();
          } else if (b.art === "motor") {
            g.fillStyle = BOOTFARBEN[b.farbe];
            g.fillRect(-L * 0.05, -B * 0.32, L * 0.32, B * 0.64);
            g.fillStyle = "#2b2f3a";
            g.fillRect(-L / 2 - 0.15 * s, -0.15 * s, 0.3 * s, 0.3 * s);
          } else if (b.art === "dampfer") {
            g.fillStyle = "#d9d3c4";
            g.fillRect(-L * 0.32, -B * 0.32, L * 0.62, B * 0.64);
            g.fillStyle = "#c2492f";
            g.beginPath();
            g.arc(L * 0.05, 0, 0.32 * s, 0, TAU);
            g.fill();
            g.fillStyle = "#2b2f3a";
            g.beginPath();
            g.arc(L * 0.05, 0, 0.16 * s, 0, TAU);
            g.fill();
            // Die Schaufelräder links und rechts.
            const rad = (state.uhr * 6) % 1;
            g.fillStyle = "#8a2f22";
            for (const seite of [-1, 1]) {
              g.fillRect(-0.6 * s, seite * B / 2 - (seite > 0 ? 0 : 0.25 * s), 1.2 * s, 0.25 * s);
              g.fillStyle = "#5b1f16";
              g.fillRect(-0.6 * s + rad * 1.2 * s, seite * B / 2 - (seite > 0 ? 0 : 0.25 * s), 0.12 * s, 0.25 * s);
              g.fillStyle = "#8a2f22";
            }
          }
        }
        g.restore();
      }
    }
  }

  function zeichneWellen() {
    const s = view.s;
    g.lineWidth = Math.max(1, 0.035 * s);
    for (const w of state.wellen) {
      const k = clamp(w.alter / w.dauer, 0, 1);
      g.strokeStyle = `rgba(255, 255, 255, ${0.35 * (1 - k)})`;
      g.beginPath();
      g.ellipse(bx(0), by(w.y), (w.r + k * 0.7) * s, (w.r * 0.6 + k * 0.25) * s, 0, Math.PI * 0.05, Math.PI * 0.95);
      g.stroke();
    }
  }

  // Eine Ente von oben: Körper, Kopf vorn (nach oben), Schnabel. Die Mutter
  // braun mit grünblauem Spiegel, die Küken gelb.
  function ente(X, Y, r, mutter, { alpha = 1, farbe = null, wackeln = 0, gross = 1 } = {}) {
    const s = view.s * gross;
    g.save();
    g.globalAlpha = alpha;
    g.translate(X, Y);
    g.rotate(wackeln);
    if (!farbe) {
      g.fillStyle = "rgba(0, 0, 0, 0.18)";
      g.beginPath();
      g.ellipse(0.04 * s, 0.06 * s, r * s * 0.95, r * s * 1.2, 0, 0, TAU);
      g.fill();
    }
    g.fillStyle = farbe || (mutter ? "#8a6236" : "#ffd84a");
    g.beginPath();
    g.ellipse(0, 0.1 * r * s, r * s * 0.82, r * s * 1.12, 0, 0, TAU);
    g.fill();
    if (mutter && !farbe) {
      g.fillStyle = "#6a4a26";
      g.beginPath();
      g.ellipse(0, 0.25 * r * s, r * s * 0.55, r * s * 0.7, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#2f7fa8";
      g.fillRect(-r * s * 0.8, 0.15 * r * s, r * s * 0.18, r * s * 0.4);
      g.fillRect(r * s * 0.62, 0.15 * r * s, r * s * 0.18, r * s * 0.4);
    }
    // Der Kopf.
    g.fillStyle = farbe || (mutter ? "#7a5530" : "#ffe27a");
    g.beginPath();
    g.arc(0, -r * s * 0.85, r * s * 0.5, 0, TAU);
    g.fill();
    g.fillStyle = farbe || "#ff9a2e";
    g.beginPath();
    g.ellipse(0, -r * s * 1.38, r * s * 0.2, r * s * 0.18, 0, 0, TAU);
    g.fill();
    if (!farbe) {
      g.fillStyle = "#1b1b1b";
      g.beginPath();
      g.arc(-r * s * 0.22, -r * s * 0.95, Math.max(0.8, r * s * 0.09), 0, TAU);
      g.arc(r * s * 0.22, -r * s * 0.95, Math.max(0.8, r * s * 0.09), 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function zeichneFamilie() {
    const e = state.enten;
    for (let i = e.length - 1; i >= 0; i -= 1) {
      const d = e[i];
      const neu = state.neu.find((x) => x.ente === d);
      const auf = neu ? Math.sin(clamp(neu.alter / 0.6, 0, 1) * Math.PI) * 0.25 : 0;
      const wackeln = ruhig() ? 0 : Math.sin(state.zeit * (d.v > 0.2 ? 14 : 4) + i) * (d.v > 0.2 ? 0.12 : 0.05);
      const getroffen = state.schritt === "erwischt" && i === state.getroffen;
      ente(bx(getroffen ? Math.sin((state.zeit - state.endeZeit) * 9) * 0.3 : 0), by(d.y + auf), d.r, i === 0, {
        wackeln: getroffen ? (state.zeit - state.endeZeit) * 9 : wackeln,
        alpha: getroffen ? clamp(1 - (state.zeit - state.endeZeit) * 0.6, 0.2, 1) : 1,
      });
    }
  }

  // Die Gegner: eine Mutterente aus Licht links neben der Familie, so weit,
  // wie sie damals zu dieser Zeit war.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const da = [];
    orte.forEach((o, i) => {
      if (o.ziel) return;
      const y = (o.a || 0) / 10;
      const x = -1.1 - i * 0.8;
      ente(bx(x), by(y), MUTTER_R, true, { farbe: o.farbe, alpha: 0.55 * o.blass });
      da.push({ ...o, sx: bx(x), sy: by(y) - 0.9 * view.s, weit: "" });
    });
    if (da.length) window.LernappGeist.namen(g, da, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneSpritzer() {
    for (const t of state.spritzer) {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      g.fillStyle = "#e8f6ff";
      g.beginPath();
      g.arc(bx(t.x), by(t.y), Math.max(1, t.r * view.s), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Weiter weg als VORAUS verschwinden die Boote im Dunst – auf jedem
  // Bildschirm sieht man gleich weit voraus.
  function zeichneDunst() {
    const W = view.cssW;
    const rand = bx(VORAUS);
    if (rand >= W) return;
    for (const seite of [-1, 1]) {
      const innen = seite > 0 ? rand : bx(-VORAUS);
      const aussen = seite > 0 ? Math.min(W, rand + 1.5 * view.s) : Math.max(0, bx(-VORAUS) - 1.5 * view.s);
      const v = g.createLinearGradient(innen, 0, aussen, 0);
      v.addColorStop(0, "rgba(214, 226, 236, 0)");
      v.addColorStop(1, "rgba(214, 226, 236, 0.92)");
      g.fillStyle = v;
      if (seite > 0) g.fillRect(innen, -10, W - innen + 10, view.cssH + 20);
      else g.fillRect(-10, -10, innen + 10, view.cssH + 20);
    }
  }

  // Das Abendlicht: erst warm, zuletzt rot und dunkel.
  function zeichneLicht() {
    const k = abend();
    if (k <= 0.02) return;
    g.fillStyle = k < 0.7 ? `rgba(255, 170, 60, ${0.18 * (k / 0.7)})` : `rgba(${Math.round(lerp(255, 120, (k - 0.7) / 0.3))}, ${Math.round(lerp(170, 60, (k - 0.7) / 0.3))}, ${Math.round(lerp(60, 90, (k - 0.7) / 0.3))}, ${0.18 + 0.2 * ((k - 0.7) / 0.3)})`;
    g.fillRect(-10, -10, view.cssW + 20, view.cssH + 20);
  }

  function zeichneSchriften() {
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of state.schriften) {
      const k = clamp(t.leben / t.max, 0, 1);
      const X = clamp(bx(t.x), 70, view.cssW - 70);
      const Y = clamp(by(t.y) - (1 - k) * 18, view.frei + 70, view.cssH - 30);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${Math.round(t.gross)}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, t.gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(8, 30, 40, 0.8)";
      g.strokeText(t.text, X, Y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, X, Y);
    }
    g.globalAlpha = 1;
  }

  function pille(text, x, y, gross, grund, farbe) {
    g.font = `900 ${gross}px system-ui, sans-serif`;
    const w = g.measureText(text).width + gross * 1.4;
    const h = gross * 1.7;
    g.fillStyle = grund;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2);
    else g.rect(x, y, w, h);
    g.fill();
    g.fillStyle = farbe;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x + gross * 0.7, y + h / 2 + 1);
    return h;
  }

  // Oben links, unter den Knöpfen: die Punkte, der Fluss mit seinen Küken –
  // und, solange die Familie im Wasser ist und nicht angehalten hat, «in
  // einem Zug».
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    g.save();
    g.translate(0, view.frei);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    const x = 12;
    let y = 12;
    y += pille(`${state.punkte}`, x, y, Math.round(gross), "rgba(8, 30, 40, 0.6)", "#ffffff") + 6;
    const klein = Math.round(gross * 0.6);
    const k = state.enten.length - 1;
    y += pille(`Fluss ${state.fluss + 1} · ${k} Küken`, x, y, klein, "rgba(8, 30, 40, 0.55)", "#ffe27a") + 5;
    if (state.imWasser && state.inEinemZug && state.schritt === "unterwegs") {
      pille("In einem Zug: ×2", x, y, klein, "rgba(255, 210, 63, 0.92)", "#2a1d00");
    }
    g.restore();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Ein aufgezeichneter Lauf: Der Zufall hält die Saat, startRun baut damit
  // dieselben Boote, die Uhr läuft wie damals, und die Mutter ist Bild für
  // Bild dort, wo sie war. Die Küken folgen ihr nach derselben Regel.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.uhr = (zuschauer.lauf.vorlauf || 0) / 1000;
    shell.setPhase("play");
    shell.startClock(DAUER * 1000, () => {});
    zuschauer.los();
    ambientAn();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) { state.uhr += dt; return; }
    state.uhr = ((zuschauer.lauf?.vorlauf || 0) + s.t) / 1000;
    state.seitStart = s.t / 1000;
    if (state.schritt === "unterwegs") {
      const ziel = (s.a || 0) / 10;
      const h = Math.max(dt, 1e-3);
      const weg = Math.max(0, ziel - state.enten[0].y);
      // Die Mutter dorthin, die Küken nach der Regel hinterher.
      const n = Math.max(1, Math.ceil(dt / TAKT));
      for (let i = 0; i < n; i += 1) {
        familieSchritt(h / n, weg / n);
        wasserUndUfer();
      }
    }
    const punkte = Math.max(0, Math.round(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    if (!zuschauer.weiter()) {
      // Am Ende des Laufs: Traf ein Boot, zeigt sich das jetzt.
      if (state.schritt === "unterwegs") {
        for (let i = 0; i < state.enten.length; i += 1) {
          const r = reiheBei(state.enten[i].y);
          if (r?.art === "bahn" && trifftBoot(r, state.uhr, state.enten[i].r + 0.4)) { erwischt(i); break; }
        }
      }
      ambientAus();
    }
  }

  // ---------------------------------------------------------------------------
  // Halten und Loslassen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Druck – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los). Dann läuft die Uhr bis
  // Sonnenuntergang.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.seitStart = 0;
    shell.setPhase("play");
    shell.startClock(DAUER * 1000, () => finish());
    gegner?.los();
    ambientAn();
    kids()?.vibrate?.(8);
  }

  function druecken() {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    gedrueckt = true;
    if (!shell.live) losGehts();
  }

  function loslassen() {
    gedrueckt = false;
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    ambientAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "unterwegs";
    state.punkte = 0;
    state.fluesse = [];
    fluesseBis(3);
    state.fluss = 0;
    state.geschafft = 0;
    state.zuege = 0;
    state.getroffen = -1;
    state.imWasser = false;
    state.inEinemZug = true;
    state.neu = [];
    state.wellen = [];
    state.spritzer = [];
    state.schriften = [];
    state.stoss = 0;
    state.zeit = 0;
    state.uhr = 0;
    state.seitStart = 0;
    familieAufbauen(kuekenBei(0));
    state.camY = kameraZiel();
    gedrueckt = false;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt ef-prompt", "Halten – schwimmen. Loslassen – warten. Bring alle Küken über den Fluss.");
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
    const dauer = Math.min(800, 200 + ziel * 12);
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
    if (state.phase === "zuschauen") return;
    clearStep();
    stopLoop();
    ambientAus();
    shell.stopClock?.();
    if (state.phase === "ende") return;
    state.phase = "ende";
    gedrueckt = false;
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const fluesse = state.geschafft === 1 ? "1 Fluss" : `${state.geschafft} Flüsse`;
    const zuege = state.zuege ? `${state.zuege} in einem Zug` : "";
    const grund = state.schritt === "erwischt" ? (state.getroffen === 0 ? "Die Mutter wurde erwischt" : "Ein Küken wurde erwischt") : "Die Sonne ist untergegangen";
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! ${fluesse}` : [[fluesse, zuege].filter(Boolean).join(", "), grund, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("ef-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Entenfamilie",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: true,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "duckCrossing", fassung: "t1", zufall, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({
      spiel: "duckCrossing", host, art: "tempo", fassung: "t1", alle: true, zufall, vorlauf: () => state.uhr * 1000,
    }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  // Wer das Fenster verlässt, nimmt auch den Finger vom Bild.
  window.addEventListener("blur", loslassen);

  const TASTEN = new Set([" ", "Enter", "ArrowUp"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key) && event.code !== "KeyW") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    druecken();
  });
  document.addEventListener("keyup", (event) => {
    if (!TASTEN.has(event.key) && event.code !== "KeyW") return;
    loslassen();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); ambientAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappEntenfamilie = {
    TAKT, DAUER, V_ENTE, BAHN_W, MUTTER_R, KUEKEN_R, ABSTAND,
    state, view, takt, zeichnen, druecken, loslassen, losGehts, weltText,
    fluesseBis, bootePos, trifftBoot, reiheBei, bahnenBei, kuekenBei, ketteBei,
    querungOk, wartenBisWelle,
    gedrueckt: () => gedrueckt,
  };
})();
