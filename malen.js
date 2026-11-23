/*
 * malen.js – Malen und Raten: Eine malt, die andere rät.
 * ---------------------------------------------------------------------------
 * Die Seite /malen. Ein Spiel miteinander (gemeinsam): sechs Runden, die
 * Rollen wechseln jede Runde. Wer malt, sieht ein Wort mit seinem Bild und
 * malt es mit dem Finger. Wer rät, sieht die Striche, während sie entstehen,
 * und tippt auf eine der Antworten (Bild und Wort – auch wer noch nicht
 * liest, kann raten). Drei Versuche je Runde. Werden vier der sechs Wörter
 * erraten, ist es geschafft.
 *
 * Gegen den Computer wechselt es auch jede Runde. Malt er, zeichnet er sein
 * Bild des Wortes Strich für Strich, und man rät. Malt man selbst, schaut er
 * zu und rät, sobald genug auf dem Papier ist und eine Weile nichts dazukommt
 * (oder sofort auf «Fertig – rate!»): Er vergleicht die Zeichnung mit seinen
 * eigenen Bildern der Wörter, die zur Wahl stehen. Die Stufe bestimmt, wie
 * viele Antworten zur Wahl stehen – und wie viel er zeichnet, bevor man raten
 * muss.
 *
 * Die Striche gehen nicht über die Züge, sondern über einen eigenen Ort in
 * der Datenbank (LernappZwei.live, partie/<raum>/live/<partie>-<runde>):
 * Punkte von 0 bis 1000, «x,y;x,y|x,y;…». Ein Zug ist nur das Raten: «R2:3»
 * – in Runde 2 die Antwort 3.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "malen") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const RUNDEN = 6;
  const ZIEL = 4;
  const VERSUCHE = 3;

  // --- Die Wörter, und wie der Computer sie malt --------------------------------
  // Hilfen: ein Kreis, ein Bogen, eine Linie, ein Vieleck (Punkte 0–1000).
  const kreis = (cx, cy, r, n = 28) => Array.from({ length: n + 1 }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);
  const oval = (cx, cy, rx, ry, n = 30) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)]);
  const bogen = (cx, cy, r, von, bis, n = 18) => Array.from({ length: n + 1 }, (_, i) => { const w = ((von + ((bis - von) * i) / n) * Math.PI) / 180; return [cx + r * Math.cos(w), cy + r * Math.sin(w)]; });
  const linie = (x1, y1, x2, y2) => [[x1, y1], [x2, y2]];
  const strahlen = (cx, cy, r1, r2, n) => Array.from({ length: n }, (_, i) => { const w = (2 * Math.PI * i) / n; return linie(cx + r1 * Math.cos(w), cy + r1 * Math.sin(w), cx + r2 * Math.cos(w), cy + r2 * Math.sin(w)); });

  const WOERTER = [
    { wort: "Sonne", bild: "🌞", malen: () => [kreis(500, 500, 170), ...strahlen(500, 500, 230, 330, 10)] },
    { wort: "Haus", bild: "🏠", malen: () => [[[300, 460], [300, 800], [700, 800], [700, 460]], [[260, 480], [500, 240], [740, 480]], [[450, 800], [450, 650], [550, 650], [550, 800]], [[360, 540], [420, 540], [420, 600], [360, 600], [360, 540]]] },
    { wort: "Baum", bild: "🌳", malen: () => [[[460, 870], [460, 600], [540, 600], [540, 870]], kreis(500, 420, 210), bogen(430, 400, 60, 200, 340, 8), bogen(580, 460, 50, 200, 340, 8)] },
    { wort: "Katze", bild: "🐱", malen: () => [kreis(500, 540, 220), [[330, 400], [300, 220], [440, 340]], [[560, 340], [700, 220], [670, 400]], kreis(420, 510, 25, 12), kreis(580, 510, 25, 12), [[480, 590], [500, 610], [520, 590]], linie(300, 590, 440, 600), linie(300, 640, 440, 620), linie(700, 590, 560, 600), linie(700, 640, 560, 620)] },
    { wort: "Fisch", bild: "🐟", malen: () => [oval(450, 500, 240, 140), [[680, 500], [840, 370], [840, 630], [680, 500]], kreis(330, 470, 20, 10), bogen(450, 500, 90, -50, 50, 8)] },
    { wort: "Auto", bild: "🚗", malen: () => [[[180, 620], [820, 620], [820, 490], [660, 490], [580, 370], [380, 370], [300, 490], [180, 490], [180, 620]], kreis(330, 630, 75), kreis(670, 630, 75), [[400, 400], [400, 480], [560, 480], [500, 400], [400, 400]]] },
    { wort: "Blume", bild: "🌸", malen: () => [kreis(500, 380, 60, 16), ...Array.from({ length: 6 }, (_, i) => kreis(500 + 125 * Math.cos((i * Math.PI) / 3), 380 + 125 * Math.sin((i * Math.PI) / 3), 70, 16)), linie(500, 520, 500, 880), oval(580, 700, 70, 30, 14)] },
    { wort: "Herz", bild: "❤️", malen: () => [Array.from({ length: 41 }, (_, i) => { const t = (2 * Math.PI * i) / 40; return [500 + 16 * Math.sin(t) ** 3 * 18, 470 - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 18]; })] },
    { wort: "Stern", bild: "⭐", malen: () => [Array.from({ length: 11 }, (_, i) => { const w = (Math.PI / 5) * i - Math.PI / 2; const r = i % 2 ? 150 : 340; return [500 + r * Math.cos(w), 520 + r * Math.sin(w)]; })] },
    { wort: "Mond", bild: "🌙", malen: () => [bogen(500, 500, 300, 60, 300, 24), bogen(620, 500, 240, 105, 255, 20)] },
    { wort: "Ball", bild: "⚽", malen: () => [kreis(500, 500, 280), Array.from({ length: 6 }, (_, i) => { const w = (2 * Math.PI * i) / 5 - Math.PI / 2; return [500 + 90 * Math.cos(w), 500 + 90 * Math.sin(w)]; }), ...strahlen(500, 500, 90, 280, 5)] },
    { wort: "Schiff", bild: "⛵", malen: () => [[[220, 640], [780, 640], [690, 790], [310, 790], [220, 640]], linie(500, 640, 500, 200), [[520, 230], [740, 590], [520, 590], [520, 230]], [[480, 300], [300, 590], [480, 590]]] },
    { wort: "Apfel", bild: "🍎", malen: () => [kreis(500, 570, 240), [[500, 340], [520, 220]], oval(590, 260, 70, 32, 14)] },
    { wort: "Rakete", bild: "🚀", malen: () => [[[440, 760], [440, 360], [500, 180], [560, 360], [560, 760], [440, 760]], [[440, 620], [350, 760], [440, 760]], [[560, 620], [650, 760], [560, 760]], kreis(500, 430, 45, 14), [[470, 760], [500, 870], [530, 760]]] },
    { wort: "Pilz", bild: "🍄", malen: () => [[...bogen(500, 540, 290, 180, 360, 22), [210, 540]], [[430, 540], [420, 820], [580, 820], [570, 540]], kreis(420, 430, 35, 12), kreis(580, 410, 40, 12), kreis(500, 330, 30, 12)] },
    { wort: "Eis", bild: "🍦", malen: () => [[[370, 470], [630, 470], [500, 880], [370, 470]], [...bogen(500, 470, 140, 180, 360, 18), [360, 470]], linie(420, 560, 560, 620), linie(440, 680, 540, 720)] },
    { wort: "Brille", bild: "👓", malen: () => [kreis(330, 520, 130), kreis(670, 520, 130), bogen(500, 520, 50, 200, 340, 8), linie(200, 500, 110, 440), linie(800, 500, 890, 440)] },
    { wort: "Schnecke", bild: "🐌", malen: () => [Array.from({ length: 60 }, (_, i) => { const w = i * 0.32; const r = 8 + i * 3.4; return [560 + r * Math.cos(w), 480 + r * Math.sin(w)]; }), [[160, 720], [800, 720], [800, 660]], [[230, 720], [200, 560], [260, 560], [300, 720]], linie(220, 560, 190, 450), linie(250, 560, 280, 450)] },
    { wort: "Schlange", bild: "🐍", malen: () => [Array.from({ length: 50 }, (_, i) => [150 + i * 13, 560 + 120 * Math.sin(i / 5)]), kreis(800, 470, 55, 14), [[850, 470], [920, 450], [900, 470], [920, 490]]] },
    { wort: "Ballon", bild: "🎈", malen: () => [oval(500, 400, 200, 250), [[480, 650], [520, 650], [500, 680], [480, 650]], Array.from({ length: 20 }, (_, i) => [500 + 30 * Math.sin(i / 2), 680 + i * 12])] },
  ];

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
  const mischen = (liste, rnd) => { const a = [...liste]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // --- Wie der Computer eine Zeichnung errät ---------------------------------------
  /*
   * Er vergleicht sie mit seinen eigenen Bildern der Wörter, die zur Wahl
   * stehen: Beide werden auf ein Raster von 32 × 32 gelegt (Grösse und Lage
   * egal: das Bild füllt das Raster), dann zählt, wie weit die Striche des
   * einen im Mittel von denen des anderen weg sind – in beide Richtungen.
   * Das Wort mit dem kleinsten Abstand rät er zuerst.
   */
  const RASTER = 32;
  function rastern(striche) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const s of striche) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (!Number.isFinite(x0)) return null;
    const seite = Math.max(x1 - x0, y1 - y0, 1);
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const feld = new Uint8Array(RASTER * RASTER);
    const fuell = RASTER - 5;
    const setze = (x, y) => {
      const gx = Math.round(RASTER / 2 + ((x - mx) / seite) * fuell);
      const gy = Math.round(RASTER / 2 + ((y - my) / seite) * fuell);
      if (gx >= 0 && gy >= 0 && gx < RASTER && gy < RASTER) feld[gy * RASTER + gx] = 1;
    };
    const schritt = seite / fuell / 2;
    for (const s of striche) {
      if (s.length === 1) setze(s[0][0], s[0][1]);
      for (let i = 1; i < s.length; i += 1) {
        const [ax, ay] = s[i - 1];
        const [bx, by] = s[i];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / schritt));
        for (let k = 0; k <= n; k += 1) setze(ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n);
      }
    }
    return feld;
  }
  // Wie weit jedes Feld vom nächsten Strich weg ist (zwei Durchgänge).
  function abstaende(feld) {
    const d = new Float32Array(RASTER * RASTER);
    for (let i = 0; i < d.length; i += 1) d[i] = feld[i] ? 0 : 999;
    const S = 1.41;
    for (let y = 0; y < RASTER; y += 1) for (let x = 0; x < RASTER; x += 1) {
      const i = y * RASTER + x;
      if (x > 0) d[i] = Math.min(d[i], d[i - 1] + 1);
      if (y > 0) {
        d[i] = Math.min(d[i], d[i - RASTER] + 1);
        if (x > 0) d[i] = Math.min(d[i], d[i - RASTER - 1] + S);
        if (x < RASTER - 1) d[i] = Math.min(d[i], d[i - RASTER + 1] + S);
      }
    }
    for (let y = RASTER - 1; y >= 0; y -= 1) for (let x = RASTER - 1; x >= 0; x -= 1) {
      const i = y * RASTER + x;
      if (x < RASTER - 1) d[i] = Math.min(d[i], d[i + 1] + 1);
      if (y < RASTER - 1) {
        d[i] = Math.min(d[i], d[i + RASTER] + 1);
        if (x < RASTER - 1) d[i] = Math.min(d[i], d[i + RASTER + 1] + S);
        if (x > 0) d[i] = Math.min(d[i], d[i + RASTER - 1] + S);
      }
    }
    return d;
  }
  const vorlagen = new Map();
  function vorlage(wort) {
    if (!vorlagen.has(wort)) { const feld = rastern(WOERTER[wort].malen()); vorlagen.set(wort, { feld, abstand: abstaende(feld) }); }
    return vorlagen.get(wort);
  }
  function abstand(feld, abstandFeld, anderes) {
    let summe = 0;
    let n = 0;
    for (let i = 0; i < feld.length; i += 1) if (feld[i]) { summe += Math.min(abstandFeld[i], 12); n += 1; }
    return n ? summe / n : 99;
  }
  // Die Wörter (Nummern in WOERTER), vom ähnlichsten zum unähnlichsten.
  function erkenne(striche, woerter) {
    const feld = rastern(striche);
    if (!feld) return [...woerter];
    const eigen = abstaende(feld);
    return woerter
      .map((w) => { const v = vorlage(w); return { w, wert: abstand(feld, v.abstand) + abstand(v.feld, eigen) }; })
      .sort((p, q) => p.wert - q.wert)
      .map((p) => p.w);
  }
  // Wie lang alle Striche zusammen sind (0–1000 je Seite).
  const tinte = (striche) => striche.reduce((n, s) => n + s.reduce((m, p, i) => (i ? m + Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : m), 0), 0);

  // Wie viele Antworten zur Wahl stehen, und wie viel der Computer malt.
  const STUFEN = { leicht: { wahl: 3, anteil: 1 }, einfach: { wahl: 4, anteil: 1 }, mittel: { wahl: 6, anteil: 0.8 }, schwer: { wahl: 8, anteil: 0.6 } };
  const DUELL = { wahl: 6, anteil: 1 };

  // Die Runden einer Partie: sechs verschiedene Wörter, und je Runde die
  // Antworten (das richtige darunter).
  function runden(saat, stufe) {
    const art = STUFEN[stufe] || DUELL;
    const rnd = wuerfel((Number(saat) ^ 0x3a1e) >>> 0);
    const reihe = mischen(WOERTER.map((_, i) => i), rnd).slice(0, RUNDEN);
    return reihe.map((wort) => {
      const andere = mischen(WOERTER.map((_, i) => i).filter((i) => i !== wort), rnd).slice(0, art.wahl - 1);
      const wahl = mischen([wort, ...andere], rnd);
      return { wort, wahl, richtig: wahl.indexOf(wort) };
    });
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt, saat, stufe }) {
    const rs = runden(saat, stufe);
    // Wer malt, wechselt jede Runde – auch gegen den Computer.
    const maler = (r) => (r % 2 === 0 ? beginnt : anderer(beginnt));
    const l = { runden: rs, runde: 0, falsch: [], erraten: 0, verlauf: [], ende: null, stufe: stufe || null };
    for (const z of zuege) {
      const m = /^R(\d):(\d)$/.exec(z);
      if (!m || l.ende || Number(m[1]) !== l.runde || Number(m[2]) >= rs[l.runde].wahl.length || l.falsch.includes(Number(m[2]))) {
        return { ...l, maler: maler(l.runde), dran: null, kaputt: true };
      }
      const wahl = Number(m[2]);
      const r = rs[l.runde];
      if (wahl === r.richtig) {
        l.erraten += 1;
        l.verlauf.push({ runde: l.runde, erraten: true, falsch: [...l.falsch] });
        l.runde += 1;
        l.falsch = [];
      } else {
        l.falsch.push(wahl);
        if (l.falsch.length >= VERSUCHE) {
          l.verlauf.push({ runde: l.runde, erraten: false, falsch: [...l.falsch] });
          l.runde += 1;
          l.falsch = [];
        }
      }
      if (l.runde >= RUNDEN) l.ende = l.erraten >= ZIEL ? "g" : "v";
    }
    const m = l.ende ? maler(RUNDEN - 1) : maler(l.runde);
    return { ...l, maler: m, rater: anderer(m), dran: l.ende ? null : anderer(m), letzte: l.verlauf[l.verlauf.length - 1] || null };
  }

  function darf(l, zug, sitz) {
    const m = /^R(\d):(\d)$/.exec(zug);
    return Boolean(m) && !l.ende && l.dran === sitz && Number(m[1]) === l.runde && Number(m[2]) < l.runden[l.runde].wahl.length && !l.falsch.includes(Number(m[2]));
  }

  // --- Der Computer ---------------------------------------------------------------
  // Was man gerade malt (gegen den Computer), damit er es erraten kann.
  const kinderBild = { stueck: "", striche: [], stand: 0, malt: false, zuletzt: 0, fertig: 0 };
  const horcher = new Set();
  const melden = () => { for (const f of [...horcher]) f(); };
  let ruhigJetzt = () => false;

  // Malt er, macht er keinen Zug (das Bild entsteht im Brett). Malt man
  // selbst, wartet er, bis genug auf dem Papier ist und eine Weile nichts
  // dazukommt – oder bis «Fertig – rate!» getippt wird – und rät dann das
  // Wort, dessen Bild der Zeichnung am ähnlichsten ist. Nach einem Fehlversuch
  // wartet er wieder, bis etwas dazugemalt wird (oder eine längere Weile).
  const MINDEST_TINTE = 400;
  function computer(l, sitz, stufe, { nr } = {}) {
    if (l.ende || l.dran !== sitz || l.maler === sitz) return null;
    const stueck = `${nr}-${l.runde}`;
    const r = l.runden[l.runde];
    const nochmal = l.falsch.length > 0;
    const anfang = Date.now();
    const standVorher = kinderBild.stueck === stueck ? kinderBild.stand : -1;
    const fertigVorher = kinderBild.stueck === stueck ? kinderBild.fertig : 0;
    return new Promise((fertig) => {
      let uhr = 0;
      const raus = (antwort) => { horcher.delete(pruefen); window.clearTimeout(uhr); fertig(antwort); };
      const los = () => {
        const offen = r.wahl.filter((_, i) => !l.falsch.includes(i));
        const wort = erkenne(kinderBild.striche, offen)[0];
        raus({ zug: `R${l.runde}:${r.wahl.indexOf(wort)}`, warte: ruhigJetzt() ? 80 : 600 });
      };
      function pruefen() {
        window.clearTimeout(uhr);
        // Eine andere Runde oder Partie: Hier gibt es nichts mehr zu raten.
        if (kinderBild.stueck !== stueck) { if (kinderBild.stueck) raus(null); return; }
        if (kinderBild.malt) return;
        const genug = tinte(kinderBild.striche);
        if (kinderBild.fertig > fertigVorher && genug > 0) { los(); return; }
        if (genug < MINDEST_TINTE) return;
        const neu = kinderBild.stand !== standVorher;
        const pause = ruhigJetzt() ? 400 : !nochmal ? 3000 : neu ? 2500 : 8000;
        const seit = Date.now() - Math.max(kinderBild.zuletzt, anfang);
        if (seit >= pause) { los(); return; }
        uhr = window.setTimeout(pruefen, pause - seit + 30);
      }
      horcher.add(pruefen);
      pruefen();
    });
  }

  // --- Was über dem Bild steht -------------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende) return null;
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    const vorher = l.letzte && l.letzte.runde === l.runde - 1 ? (l.letzte.erraten ? `Richtig – ${WOERTER[l.runden[l.letzte.runde].wort].wort}! ` : `Schade – es war ${WOERTER[l.runden[l.letzte.runde].wort].wort}. `) : "";
    if (l.falsch.length) {
      const rest = VERSUCHE - l.falsch.length;
      const versuche = `${rest} ${rest === 1 ? "Versuch" : "Versuche"}`;
      if (l.rater === ich) return { text: `Nicht ganz – noch ${versuche}`, sitz: l.rater };
      const geraten = WOERTER[l.runden[l.runde].wahl[l.falsch[l.falsch.length - 1]]].wort;
      if (l.maler === ich) return { text: `${er(l.rater)} meinte «${geraten}» – mal noch etwas dazu! Noch ${versuche}`, sitz: l.rater };
      return { text: `${er(l.rater)} meinte «${geraten}» – noch ${versuche}`, sitz: l.rater };
    }
    // Ganz am Anfang: wer beginnt (zu malen).
    if (l.runde === 0 && !l.verlauf.length) {
      if (l.maler === ich) return { text: "Du beginnst – male das Wort!", sitz: ich };
      return { text: modus === "computer" ? "Der Computer beginnt zu malen – was ist es?" : `${name(l.maler)} ist dran und malt – was ist es?`, sitz: l.maler };
    }
    if (l.maler === ich) return { text: `${vorher}Du malst – ${modus === "computer" ? "der Computer" : name(l.rater)} rät`, sitz: ich };
    if (l.rater === ich) return { text: `${vorher}${er(l.maler)} malt – was ist es?`, sitz: l.maler };
    return { text: `${vorher}${er(l.maler)} malt, ${er(l.rater)} rät`, sitz: l.maler };
  }

  // --- Das Bild -------------------------------------------------------------------
  const STRICH = (b) => b.map((s) => s.map(([x, y]) => `${Math.round(Math.max(0, Math.min(1000, x)))},${Math.round(Math.max(0, Math.min(1000, y)))}`).join(";")).join("|");
  const LESEN = (text) => String(text || "").split("|").filter(Boolean).map((s) => s.split(";").map((p) => p.split(",").map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite)));

  function held() {
    const bild = el("div", "zw-mr-held");
    const papier = el("span", "zw-mr-held-papier");
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 1000 1000");
    for (const s of WOERTER[0].malen()) {
      const p = document.createElementNS(NS, "polyline");
      p.setAttribute("points", s.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`).join(" "));
      svg.append(p);
    }
    papier.append(svg);
    bild.append(papier, el("span", "zw-mr-held-stift", "✏️"));
    return bild;
  }

  function brett({ zug, ton, knopf, ruhig }) {
    ruhigJetzt = ruhig;
    const knoten = el("div", "zw-mr");
    const kopf = el("div", "zw-mr-kopf");
    const rundeText = el("span", "zw-mr-runde");
    const punkte = el("span", "zw-mr-punkte");
    kopf.append(rundeText, punkte);
    const auftrag = el("div", "zw-mr-auftrag");
    const papier = el("div", "zw-mr-papier");
    const leinwand = el("canvas", "zw-mr-leinwand");
    leinwand.setAttribute("aria-label", "Das Bild");
    papier.append(leinwand);
    const werkzeug = el("div", "zw-mr-werkzeug");
    const loeschen = knopf("Alles löschen", "mini-knopf mini-knopf-still zw-mr-loeschen", () => { meine = []; senden(true); malenNeu(); });
    // Gegen den Computer: «Fertig – rate!» lässt ihn sofort raten.
    const fertigKnopf = knopf("Fertig – rate!", "mini-knopf mini-knopf-voll zw-mr-fertig", () => {
      if (!meine.length) return;
      kinderBild.fertig += 1;
      ton("tipp");
      melden();
    });
    werkzeug.append(loeschen, fertigKnopf);
    const antworten = el("div", "zw-mr-antworten");
    knoten.append(kopf, auftrag, papier, werkzeug, antworten);

    let jetzt = null;
    let stueck = "";        // «partie-runde»: was gerade gemalt wird
    let meine = [];         // meine Striche (wer malt)
    let fremde = [];        // die Striche, die ankommen (wer rät)
    let abmelden = null;
    let zeichnenUhr = 0;
    let senden = () => {};
    let gezeigt = { stueck: "", striche: 0 };
    let gefundenGezeigt = 0;

    // --- Malen mit dem Finger
    let aktiv = null;
    const punkt = (e) => {
      const r = leinwand.getBoundingClientRect();
      return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
    };
    const darfMalen = () => Boolean(jetzt && !jetzt.aus && jetzt.ich && jetzt.lage.maler === jetzt.ich && ["duell", "computer"].includes(jetzt.modus));
    leinwand.addEventListener("pointerdown", (e) => {
      if (!darfMalen()) return;
      e.preventDefault();
      leinwand.setPointerCapture?.(e.pointerId);
      aktiv = [punkt(e)];
      meine.push(aktiv);
      malenNeu();
      senden();
    });
    leinwand.addEventListener("pointermove", (e) => {
      if (!aktiv) return;
      const p = punkt(e);
      const letzter = aktiv[aktiv.length - 1];
      if (Math.hypot(p[0] - letzter[0], p[1] - letzter[1]) < 6) return;
      aktiv.push(p);
      malenNeu();
      senden();
    });
    const ende = () => { if (!aktiv) return; aktiv = null; senden(true); };
    leinwand.addEventListener("pointerup", ende);
    leinwand.addEventListener("pointercancel", ende);

    function groesse() {
      const r = leinwand.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(r.width * dpr));
      if (leinwand.width !== w) { leinwand.width = w; leinwand.height = w; }
      return w;
    }
    function malenNeu(striche = null, bis = Infinity) {
      const w = groesse();
      const ctx = leinwand.getContext("2d");
      ctx.clearRect(0, 0, w, w);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = w * 0.014;
      ctx.strokeStyle = "#2a2150";
      const alle = striche || (darfMalen() ? meine : fremde);
      let n = 0;
      for (const s of alle) {
        if (!s.length) continue;
        ctx.beginPath();
        ctx.moveTo((s[0][0] / 1000) * w, (s[0][1] / 1000) * w);
        for (let i = 1; i < s.length; i += 1) {
          if (n >= bis) break;
          ctx.lineTo((s[i][0] / 1000) * w, (s[i][1] / 1000) * w);
          n += 1;
        }
        if (s.length === 1) ctx.lineTo((s[0][0] / 1000) * w + 0.5, (s[0][1] / 1000) * w);
        ctx.stroke();
        if (n >= bis) break;
      }
    }

    // Der Computer malt: Strich für Strich, so viel die Stufe erlaubt.
    function computerMalt(l) {
      window.clearInterval(zeichnenUhr);
      const r = l.runden[l.runde];
      const ganz = WOERTER[r.wort].malen();
      const anteil = (STUFEN[l.stufe] || DUELL).anteil;
      const striche = ganz.slice(0, Math.max(1, Math.ceil(ganz.length * anteil)));
      const punkteGesamt = striche.reduce((n, s) => n + s.length, 0);
      if (ruhig()) { fremde = striche; malenNeu(); return; }
      let bis = 0;
      fremde = striche;
      zeichnenUhr = window.setInterval(() => {
        bis += 3;
        malenNeu(striche, bis);
        if (bis >= punkteGesamt) window.clearInterval(zeichnenUhr);
      }, 30);
    }

    function neuesStueck(b) {
      const l = b.lage;
      const neu = `${b.nr}-${l.runde}`;
      if (neu === stueck) return;
      stueck = neu;
      meine = [];
      fremde = [];
      abmelden?.();
      abmelden = null;
      window.clearInterval(zeichnenUhr);
      if (b.modus === "computer") {
        // Was das Kind malt, sieht der Computer (für sein Raten).
        Object.assign(kinderBild, { stueck: neu, striche: [], stand: 0, malt: false, zuletzt: Date.now(), fertig: 0 });
        melden();
      }
      if (l.ende) { malenNeu([]); return; }
      if (b.modus === "computer" && l.maler !== b.ich) { senden = () => {}; computerMalt(l); return; }
      if (b.modus === "computer") {
        senden = () => {
          Object.assign(kinderBild, { striche: meine, stand: kinderBild.stand + 1, zuletzt: Date.now(), malt: Boolean(aktiv) });
          fertigKnopf.disabled = !meine.length;
          melden();
        };
        malenNeu();
        return;
      }
      const kanal = Z.live?.(b.raum);
      if (!kanal) { malenNeu([]); return; }
      if (l.maler === b.ich) {
        let zuletzt = 0;
        let ausstehend = 0;
        senden = (sofort = false) => {
          const los = () => { zuletzt = Date.now(); kanal.schreibe(stueck, STRICH(meine)); };
          window.clearTimeout(ausstehend);
          if (sofort || Date.now() - zuletzt > 180) los(); else ausstehend = window.setTimeout(los, 180);
        };
        senden(true);
      } else {
        senden = () => {};
        abmelden = kanal.hoere(stueck, (text) => { fremde = LESEN(text); malenNeu(); });
      }
      malenNeu();
    }

    function zeichne(b) {
      if (!b) return;
      jetzt = b;
      const l = b.lage;
      neuesStueck(b);
      const ich = b.ich;
      rundeText.textContent = l.ende ? "Fertig" : `Runde ${l.runde + 1} von ${RUNDEN}`;
      // Was ihr zusammen gefunden habt – die Bilder, und wie viele noch fehlen.
      punkte.innerHTML = "";
      const gefunden = l.verlauf.filter((v) => v.erraten).map((v) => WOERTER[l.runden[v.runde].wort]);
      if (gefunden.length) {
        const bilder = el("span", "zw-mr-gefunden");
        if (gefunden.length < gefundenGezeigt) gefundenGezeigt = 0;
        gefunden.forEach((w, i) => { const g = el("span", `zw-mr-gefunden-bild${i >= gefundenGezeigt ? " ist-neu" : ""}`, w.bild); g.title = w.wort; bilder.append(g); });
        punkte.append(bilder);
      }
      gefundenGezeigt = gefunden.length;
      const wieViele = l.erraten >= ZIEL ? `${l.erraten} gefunden` : `${l.erraten} von ${ZIEL} gefunden`;
      punkte.append(el("span", "zw-mr-gefunden-zahl", wieViele));
      punkte.setAttribute("aria-label", `${wieViele}${gefunden.length ? `: ${gefunden.map((w) => w.wort).join(", ")}` : ""}`);
      // Der Auftrag: wer malt, sieht das Wort.
      const r = l.runden[Math.min(l.runde, RUNDEN - 1)];
      auftrag.innerHTML = "";
      if (!l.ende && darfMalen()) {
        auftrag.append(el("span", "zw-mr-auftrag-bild", WOERTER[r.wort].bild), el("span", "zw-mr-auftrag-wort", `Male: ${WOERTER[r.wort].wort}`));
      }
      auftrag.hidden = !auftrag.childElementCount;
      werkzeug.hidden = !darfMalen();
      fertigKnopf.hidden = b.modus !== "computer";
      fertigKnopf.disabled = !meine.length;
      papier.classList.toggle("ist-malen", darfMalen());
      // Die Antworten: wer rät, tippt; die anderen sehen sie auch.
      antworten.innerHTML = "";
      if (!l.ende) {
        const raten = Boolean(!b.aus && ich && l.rater === ich);
        r.wahl.forEach((w, i) => {
          const k = knopf("", `zw-mr-antwort${l.falsch.includes(i) ? " ist-falsch" : ""}`, () => { if (raten && !l.falsch.includes(i)) zug(`R${l.runde}:${i}`); });
          k.dataset.antwort = String(i);
          k.append(el("span", "zw-mr-antwort-bild", WOERTER[w].bild), el("span", "zw-mr-antwort-wort", WOERTER[w].wort));
          k.disabled = !raten || l.falsch.includes(i);
          antworten.append(k);
        });
      }
      antworten.classList.toggle("ist-aus", !(ich && l.rater === ich));
      // Wer malt, braucht die Antworten nicht – Platz fürs Papier.
      antworten.hidden = Boolean(!l.ende && darfMalen());
      knoten.classList.toggle("ist-dran", Boolean(ich && l.rater === ich && !b.aus));
      // Ein Ton: richtig oder daneben.
      const zahl = b.zuege.length;
      if (gezeigt.stueck && zahl > gezeigt.striche) {
        const zuletzt = b.zuege[zahl - 1];
        const [, rn, wn] = /^R(\d):(\d)$/.exec(zuletzt) || [];
        const war = l.runden[Number(rn)];
        ton(war && Number(wn) === war.richtig ? "treffer" : "platsch");
      }
      gezeigt = { stueck, striche: zahl };
      if (b.modus !== "computer" || l.ende || darfMalen()) malenNeu();
    }

    window.addEventListener("resize", () => { if (jetzt) malenNeu(); });

    return {
      knoten,
      zeichne,
      fokus: () => antworten.querySelector("button:not([disabled])")?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "malen",
    titel: "Malen und Raten",
    seite: "malen",
    unter: "Zusammen! Eine malt ein Wort, die andere rät – sechs Runden, abwechselnd. Werden vier erraten, habt ihr es geschafft.",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Drei Antworten, ganze Bilder" },
      einfach: { name: "Einfach", sterne: 1, satz: "Vier Antworten" },
      mittel: { name: "Mittel", sterne: 2, satz: "Sechs Antworten, nicht ganz fertig gemalt" },
      schwer: { name: "Schwer", sterne: 3, satz: "Acht Antworten, nur halb gemalt" },
    },
    texte: { start: "rate, was gemalt wird", geschafft: "Geschafft – ihr habt genug erraten!", verpasst: "Leider nicht geschafft – zu wenig erraten." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie: () => ({ saat: Math.floor(Math.random() * 4294967295) }),
    fuerPruefung: { WOERTER, erkenne, tinte, runden },
  });
})();
