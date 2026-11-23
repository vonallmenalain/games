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
 * Gegen den Computer malt er, und man rät: Er hat für jedes Wort ein Bild,
 * das er Strich für Strich zeichnet. Die Stufe bestimmt, wie viele Antworten
 * zur Wahl stehen – und wie viel er zeichnet, bevor man raten muss.
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
    // Gegen den Computer malt immer er (b); sonst wechselt es jede Runde.
    const maler = (r) => (stufe ? "b" : r % 2 === 0 ? beginnt : anderer(beginnt));
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

  // Gegen den Computer malt er nur; raten tut, wer spielt.
  const computer = () => null;

  // --- Was über dem Bild steht -------------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende) return null;
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    const vorher = l.letzte && l.letzte.runde === l.runde - 1 ? (l.letzte.erraten ? `Richtig – ${WOERTER[l.runden[l.letzte.runde].wort].wort}! ` : `Schade – es war ${WOERTER[l.runden[l.letzte.runde].wort].wort}. `) : "";
    if (l.falsch.length) {
      const rest = VERSUCHE - l.falsch.length;
      return { text: l.rater === ich ? `Nicht ganz – noch ${rest} ${rest === 1 ? "Versuch" : "Versuche"}` : `${er(l.rater)} hat sich vertan – noch ${rest}`, sitz: l.rater };
    }
    // Ganz am Anfang: wer beginnt (zu malen).
    if (l.runde === 0 && !l.verlauf.length) {
      if (l.maler === ich) return { text: "Du beginnst – male das Wort!", sitz: ich };
      return { text: modus === "computer" ? "Der Computer beginnt zu malen – was ist es?" : `${name(l.maler)} ist dran und malt – was ist es?`, sitz: l.maler };
    }
    if (l.maler === ich) return { text: `${vorher}Du malst – ${er(l.rater)} rät`, sitz: ich };
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
    werkzeug.append(loeschen);
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

    // --- Malen mit dem Finger
    let aktiv = null;
    const punkt = (e) => {
      const r = leinwand.getBoundingClientRect();
      return [Math.round(((e.clientX - r.left) / r.width) * 1000), Math.round(((e.clientY - r.top) / r.height) * 1000)];
    };
    const darfMalen = () => Boolean(jetzt && !jetzt.aus && jetzt.ich && jetzt.lage.maler === jetzt.ich && jetzt.modus === "duell");
    leinwand.addEventListener("pointerdown", (e) => {
      if (!darfMalen()) return;
      e.preventDefault();
      leinwand.setPointerCapture?.(e.pointerId);
      aktiv = [punkt(e)];
      meine.push(aktiv);
      malenNeu();
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
      if (l.ende) { malenNeu([]); return; }
      if (b.modus === "computer") { computerMalt(l); return; }
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
      punkte.textContent = `${l.erraten} erraten · ${ZIEL} braucht ihr`;
      // Der Auftrag: wer malt, sieht das Wort.
      const r = l.runden[Math.min(l.runde, RUNDEN - 1)];
      auftrag.innerHTML = "";
      if (!l.ende && ich && l.maler === ich && b.modus === "duell") {
        auftrag.append(el("span", "zw-mr-auftrag-bild", WOERTER[r.wort].bild), el("span", "zw-mr-auftrag-wort", `Male: ${WOERTER[r.wort].wort}`));
      }
      auftrag.hidden = !auftrag.childElementCount;
      werkzeug.hidden = !darfMalen();
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
      antworten.hidden = Boolean(ich && l.maler === ich && b.modus === "duell");
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
      if (b.modus !== "computer" || l.ende) malenNeu();
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
  });
})();
