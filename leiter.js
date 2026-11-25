/*
 * leiter.js – Leiterspiel: würfeln, Leitern hinauf, Rutschen hinunter.
 * ---------------------------------------------------------------------------
 * Die Seite /leiter. Ein Spielbrett mit den Feldern 1 bis 50 in fünf Reihen,
 * im Zickzack von unten links nach oben. Darauf Leitern (vom unteren Ende
 * geht es hinauf) und Rutschen (vom oberen Ende geht es hinunter).
 *
 * Wer dran ist, würfelt mit zwei Würfeln – und wählt einen davon: So weit
 * geht die eigene Figur. Das Brett zeigt vorher, wohin jeder Würfel führt,
 * auf eine Leiter oder auf eine Rutsche. Wer eine Sechs nimmt, darf
 * nochmal. Wer zuerst Feld 50 erreicht (oder darüber hinaus käme), gewinnt.
 * Unentschieden gibt es nicht.
 *
 * Welche Leitern und Rutschen liegen, kommt aus der Saat der Partie (drei
 * Bretter), die Würfel aus Saat und der Nummer des Wurfs – beide Geräte
 * sehen dasselbe. Ein Zug ist «W» (würfeln) oder «Z0» / «Z1» (diesen
 * Würfel nehmen), getrennt durch Punkte.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen Brett, Regeln und Computer.
 *
 * Der Computer:
 *
 *   leicht    nimmt irgendeinen Würfel
 *   einfach   nimmt meist den grösseren
 *   mittel    nimmt den, der am weitesten bringt (mit Leitern und Rutschen)
 *   schwer    ebenso, und denkt an die Sechs und an den nächsten Wurf
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "leiter") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const ZIEL = 50;
  const SPALTEN = 10;
  // Drei Bretter: { von: nach } – nach oben eine Leiter, nach unten eine
  // Rutsche, je fünf. Keine fängt dort an, wo eine andere aufhört, und alle
  // gehen fast senkrecht eine oder zwei Reihen weit – so bleibt das Brett
  // übersichtlich.
  const BRETTER = [
    { 3: 23, 9: 12, 16: 35, 27: 46, 33: 48, 19: 2, 25: 15, 38: 24, 44: 36, 47: 29 },
    { 2: 19, 7: 14, 13: 28, 22: 39, 34: 47, 17: 4, 26: 15, 32: 29, 43: 37, 49: 31 },
    { 4: 17, 10: 30, 15: 26, 24: 37, 36: 45, 18: 3, 29: 12, 33: 28, 42: 39, 48: 27 },
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
  const brettNr = (saat) => (Number(saat) >>> 0) % BRETTER.length;
  // Der n-te Wurf der Partie: zwei Würfel.
  function wurf(saat, n) {
    const rnd = wuerfel(((Number(saat) >>> 0) ^ Math.imul(n + 1, 0x9e3779b1)) >>> 0);
    return [1 + Math.floor(rnd() * 6), 1 + Math.floor(rnd() * 6)];
  }
  // Wohin ein Wert von einem Feld aus führt: das Feld, und ob es über eine
  // Leiter oder Rutsche ging.
  function ziel(brett, von, wert) {
    const auf = Math.min(ZIEL, von + wert);
    const weiter = brett[auf];
    return weiter ? { auf, nach: weiter, art: weiter > auf ? "leiter" : "rutsche" } : { auf, nach: auf, art: null };
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt, saat }) {
    const brett = BRETTER[brettNr(saat)];
    const ort = { a: 0, b: 0 };
    let dran = beginnt;
    let phase = "wuerfeln";
    let wuerfe = 0;
    let liegt = null;
    let ende = null;
    let letzter = null;
    for (const z of zuege) {
      const ok = !ende && ((phase === "wuerfeln" && z === "W") || (phase === "waehlen" && (z === "Z0" || z === "Z1")));
      if (!ok) return { brett, ort, dran: null, phase, liegt, ende, letzter, kaputt: true, zahl: zuege.length, wuerfe };
      if (z === "W") {
        liegt = wurf(saat, wuerfe);
        wuerfe += 1;
        phase = "waehlen";
        continue;
      }
      const wert = liegt[Number(z[1])];
      const von = ort[dran];
      const w = ziel(brett, von, wert);
      ort[dran] = w.nach;
      letzter = { sitz: dran, von, wert, auf: w.auf, nach: w.nach, art: w.art, nochmal: wert === 6 && w.nach < ZIEL };
      liegt = null;
      phase = "wuerfeln";
      if (ort[dran] >= ZIEL) ende = dran;
      else if (wert !== 6) dran = anderer(dran);
    }
    return { brett, brettNr: brettNr(saat), ort, dran: ende ? null : dran, phase, liegt, ende, letzter, zahl: zuege.length, wuerfe };
  }

  function darf(l, z, sitz) {
    if (l.dran !== sitz || l.ende) return false;
    return l.phase === "wuerfeln" ? z === "W" : z === "Z0" || z === "Z1";
  }

  // --- Der Computer -------------------------------------------------------------
  // Was ein Feld im Schnitt beim nächsten Wurf bringt (zwei Würfel, den
  // besseren nehmen).
  function erwartet(brett, von) {
    let summe = 0;
    for (let x = 1; x <= 6; x += 1) for (let y = 1; y <= 6; y += 1) summe += Math.max(ziel(brett, von, x).nach, ziel(brett, von, y).nach);
    return summe / 36;
  }

  function computer(l, sitz, stufe) {
    if (l.dran !== sitz || l.ende) return null;
    if (l.phase === "wuerfeln") return { zug: "W", warte: 700 + Math.random() * 300 };
    const [x, y] = l.liegt;
    const von = l.ort[sitz];
    const gut = (w) => {
      const z = ziel(l.brett, von, w);
      if (stufe === "mittel") return z.nach;
      // schwer: wohin, und was der nächste Wurf von dort bringt (mit der
      // Sechs gleich).
      return z.nach >= ZIEL ? 1000 : z.nach * 0.6 + erwartet(l.brett, z.nach) * 0.4 + (w === 6 ? 3 : 0);
    };
    let k;
    if (stufe === "leicht") k = Math.random() < 0.5 ? 0 : 1;
    else if (stufe === "einfach") k = Math.random() < 0.8 ? (x >= y ? 0 : 1) : (Math.random() < 0.5 ? 0 : 1);
    else k = gut(x) >= gut(y) ? 0 : 1;
    // Erst wählen, wenn man die Würfel gesehen hat.
    return { zug: `Z${k}`, warte: 1200 + Math.random() * 400 };
  }

  // --- Was über dem Brett steht ---------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran) return null;
    const wer = (sitz) => (modus === "computer" && sitz === "b" ? "der Computer" : name(sitz));
    const Wer = (sitz) => { const w = wer(sitz); return w.charAt(0).toUpperCase() + w.slice(1); };
    const z = l.letzter;
    let vorher = "";
    if (z && l.phase === "wuerfeln") {
      if (z.art === "leiter") vorher = z.sitz === ich ? `Leiter! Hinauf auf ${z.nach}. ` : `${Wer(z.sitz)} klettert auf ${z.nach}. `;
      else if (z.art === "rutsche") vorher = z.sitz === ich ? `Rutsche! Hinunter auf ${z.nach}. ` : `${Wer(z.sitz)} rutscht auf ${z.nach}. `;
      if (z.nochmal) return { text: `${vorher}Eine Sechs – ${z.sitz === ich ? "du darfst" : `${wer(z.sitz)} darf`} nochmal!`, sitz: z.sitz };
    }
    if (l.dran === ich) {
      if (l.phase === "waehlen") return { text: `Welchen Würfel nimmst du – ${l.liegt[0]} oder ${l.liegt[1]}?`, sitz: ich };
      if (!l.zahl) return { text: "Du beginnst – würfle!", sitz: ich };
      return { text: `${vorher}Du bist dran – würfle!`, sitz: ich };
    }
    if (vorher) return { text: `${vorher}${Wer(l.dran)} ist dran.`, sitz: l.dran };
    return null;
  }

  // --- Das Bild -------------------------------------------------------------------
  // Feld n (1–50) im Zickzack: Reihe von unten, in geraden Reihen nach rechts.
  const zeileVon = (n) => 4 - Math.floor((n - 1) / SPALTEN);
  const spalteVon = (n) => { const r = Math.floor((n - 1) / SPALTEN); const i = (n - 1) % SPALTEN; return r % 2 ? SPALTEN - 1 - i : i; };
  const mitte = (n) => ({ x: (spalteVon(n) + 0.5) * 10, y: (zeileVon(n) + 0.5) * 10 });
  const NS = "http://www.w3.org/2000/svg";

  function augen(wert) {
    const w = el("span", `zw-lt-augen ist-${wert}`);
    for (let i = 0; i < wert; i += 1) w.append(el("span", "zw-lt-auge"));
    return w;
  }

  function held() {
    const bild = el("div", "zw-lt-held");
    for (let i = 0; i < 12; i += 1) bild.append(el("span", `zw-lt-held-feld${i % 2 ? " ist-dunkel" : ""}`));
    bild.append(el("span", "zw-lt-held-leiter"), el("span", "zw-lt-held-rutsche"), el("span", "zw-lt-figur ist-a ist-held"));
    const w = el("span", "zw-lt-held-wuerfel");
    w.append(augen(5));
    bild.append(w);
    return bild;
  }

  function wegSvg(brett) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 50");
    svg.setAttribute("class", "zw-lt-wege");
    svg.setAttribute("aria-hidden", "true");
    for (const [von, nach] of Object.entries(brett).map(([a, b]) => [Number(a), b])) {
      const a = mitte(von); const b = mitte(nach);
      const g = document.createElementNS(NS, "g");
      if (nach > von) {
        // Leiter: zwei Holme und Sprossen.
        g.setAttribute("class", "zw-lt-leiter");
        const dx = b.x - a.x; const dy = b.y - a.y; const lang = Math.hypot(dx, dy);
        const nx = (-dy / lang) * 1.6; const ny = (dx / lang) * 1.6;
        for (const s of [1, -1]) {
          const h = document.createElementNS(NS, "line");
          h.setAttribute("x1", String(a.x + nx * s)); h.setAttribute("y1", String(a.y + ny * s));
          h.setAttribute("x2", String(b.x + nx * s)); h.setAttribute("y2", String(b.y + ny * s));
          h.setAttribute("class", "zw-lt-holm");
          g.append(h);
        }
        const sprossen = Math.max(2, Math.round(lang / 3.2));
        for (let i = 1; i < sprossen; i += 1) {
          const t = i / sprossen;
          const p = document.createElementNS(NS, "line");
          p.setAttribute("x1", String(a.x + dx * t + nx)); p.setAttribute("y1", String(a.y + dy * t + ny));
          p.setAttribute("x2", String(a.x + dx * t - nx)); p.setAttribute("y2", String(a.y + dy * t - ny));
          p.setAttribute("class", "zw-lt-sprosse");
          g.append(p);
        }
      } else {
        // Rutsche: ein geschwungenes Band.
        g.setAttribute("class", "zw-lt-rutsche");
        const mx = (a.x + b.x) / 2 + (a.y - b.y) * 0.35; const my = (a.y + b.y) / 2;
        const p = document.createElementNS(NS, "path");
        p.setAttribute("d", `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`);
        p.setAttribute("class", "zw-lt-bahn");
        const r = document.createElementNS(NS, "path");
        r.setAttribute("d", `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`);
        r.setAttribute("class", "zw-lt-streifen");
        g.append(p, r);
      }
      svg.append(g);
    }
    return svg;
  }

  function brett({ zug, ton, ruhig, knopf }) {
    const knoten = el("div", "vr-feld zw-lt");
    knoten.dataset.zuege = "0";
    const feld = el("div", "zw-lt-feld");
    const zellen = [];
    for (let r = 0; r < 5; r += 1) for (let c = 0; c < SPALTEN; c += 1) {
      const z = el("div", "zw-lt-zelle");
      feld.append(z);
      zellen.push(z);
    }
    // Zellen nach Feldnummer: ein Feld weiss seine Zahl.
    const zelleVon = (n) => zellen[zeileVon(n) * SPALTEN + spalteVon(n)];
    for (let n = 1; n <= ZIEL; n += 1) {
      const z = zelleVon(n);
      z.dataset.feld = String(n);
      z.append(el("span", "zw-lt-zahl", n === ZIEL ? "\u{1F3C1}" : String(n)));
      if ((zeileVon(n) + spalteVon(n)) % 2) z.classList.add("ist-dunkel");
    }
    let wege = null;
    const figuren = { a: el("span", "zw-lt-figur ist-a"), b: el("span", "zw-lt-figur ist-b") };
    feld.append(figuren.a, figuren.b);
    const unten = el("div", "zw-lt-unten");
    const wuerfelKnopf = knopf("", "zw-lt-wuerfeln mini-knopf mini-knopf-voll", () => zug("W"));
    wuerfelKnopf.append(el("span", "zw-lt-wuerfeln-bild", "\u{1F3B2}"), el("span", "", "Würfeln"));
    const wahl = [0, 1].map((k) => {
      const b = el("button", "zw-lt-wuerfel");
      b.type = "button";
      b.dataset.wahl = String(k);
      b.addEventListener("click", () => zug(`Z${k}`));
      return b;
    });
    const wahlen = el("div", "zw-lt-wahlen");
    wahlen.append(...wahl);
    unten.append(wuerfelKnopf, wahlen);
    knoten.append(feld, unten);

    let gezeigt = { nr: -1, zahl: -1, brett: -1 };
    let zeigeOrt = { a: 0, b: 0 };
    let marke = 0;

    function stelle(sitz, n) {
      const f = figuren[sitz];
      // Vor dem ersten Zug: klein in der Ecke von Feld 1.
      f.classList.toggle("ist-start", n <= 0);
      if (n <= 0) { const m1 = mitte(1); f.style.left = `${m1.x + (sitz === "a" ? -2.6 : 2.6)}%`; f.style.top = `${(m1.y / 50) * 100 + 5}%`; return; }
      const m = mitte(n);
      const beide = zeigeOrt.a === zeigeOrt.b;
      f.style.left = `${m.x + (beide ? (sitz === "a" ? -1.8 : 1.8) : 0)}%`;
      f.style.top = `${(m.y / 50) * 100 + (beide ? (sitz === "a" ? -2 : 2) : 0)}%`;
    }

    const pause = (ms) => new Promise((weiter) => { window.setTimeout(weiter, ms); });
    async function laufen(z, meine) {
      // Feld für Feld, dann die Leiter hinauf oder die Rutsche hinunter.
      for (let n = z.von + 1; n <= z.auf; n += 1) {
        if (meine !== marke) return;
        zeigeOrt[z.sitz] = n;
        stelle(z.sitz, n);
        stelle(anderer(z.sitz), zeigeOrt[anderer(z.sitz)]);
        ton("tipp");
        await pause(190);
      }
      if (z.art && meine === marke) {
        await pause(200);
        zeigeOrt[z.sitz] = z.nach;
        figuren[z.sitz].classList.add(z.art === "leiter" ? "ist-klettert" : "ist-rutscht");
        stelle(z.sitz, z.nach);
        stelle(anderer(z.sitz), zeigeOrt[anderer(z.sitz)]);
        ton(z.art === "leiter" ? "da" : "platsch");
        await pause(650);
        figuren[z.sitz].classList.remove("ist-klettert", "ist-rutscht");
      }
    }

    function zeichne({ lage: l, nr, ich, dran, aus }) {
      if (gezeigt.brett !== l.brettNr) {
        wege?.remove();
        wege = wegSvg(l.brett);
        feld.prepend(wege);
        for (const n of Object.keys(l.brett)) {
          const z = zelleVon(Number(n));
          z.classList.toggle("ist-leiter", l.brett[n] > Number(n));
          z.classList.toggle("ist-rutsche", l.brett[n] < Number(n));
        }
      }
      const meinZug = Boolean(!aus && ich && dran === ich && !l.ende);
      const neuerZug = nr === gezeigt.nr && l.zahl === gezeigt.zahl + 1 && l.letzter && l.phase === "wuerfeln" && !ruhig();
      if (nr !== gezeigt.nr || !neuerZug) {
        marke += 1;
        zeigeOrt = { ...l.ort };
        stelle("a", l.ort.a);
        stelle("b", l.ort.b);
      }
      if (neuerZug) {
        const z = l.letzter;
        marke += 1;
        const meine = marke;
        zeigeOrt = { ...l.ort, [z.sitz]: z.von };
        laufen(z, meine).then(() => { if (meine === marke) { zeigeOrt = { ...l.ort }; stelle("a", l.ort.a); stelle("b", l.ort.b); } });
      }
      // Würfeln oder wählen. Beim Wählen zeigt das Brett, wohin es geht.
      zellen.forEach((z) => z.classList.remove("ist-ziel-0", "ist-ziel-1"));
      wuerfelKnopf.hidden = !(l.phase === "wuerfeln" && !l.ende);
      wuerfelKnopf.disabled = !meinZug;
      wahlen.hidden = l.phase !== "waehlen";
      if (l.phase === "waehlen" && l.liegt) {
        if (nr === gezeigt.nr && l.zahl === gezeigt.zahl + 1) ton("klack");
        const von = l.ort[l.dran];
        wahl.forEach((b, k) => {
          const w = l.liegt[k];
          const zz = ziel(l.brett, von, w);
          b.innerHTML = "";
          b.append(augen(w), el("span", "zw-lt-wohin", `→ ${zz.nach}${zz.art === "leiter" ? " \u2B06\uFE0F" : zz.art === "rutsche" ? " \u2B07\uFE0F" : ""}`));
          b.classList.toggle("ist-leiter", zz.art === "leiter");
          b.classList.toggle("ist-rutsche", zz.art === "rutsche");
          b.disabled = !meinZug;
          b.setAttribute("aria-label", `Würfel ${w}: auf Feld ${zz.nach}${zz.art === "leiter" ? ", über eine Leiter" : zz.art === "rutsche" ? ", eine Rutsche hinunter" : ""}`);
          zelleVon(zz.nach)?.classList.add(`ist-ziel-${k}`);
        });
      }
      figuren.a.classList.toggle("ist-sieger", l.ende === "a");
      figuren.b.classList.toggle("ist-sieger", l.ende === "b");
      gezeigt = { nr, zahl: l.zahl, brett: l.brettNr };
      knoten.dataset.zuege = String(l.zahl);
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
    }

    return {
      knoten,
      zeichne,
      fokus: () => (!wuerfelKnopf.hidden && !wuerfelKnopf.disabled ? wuerfelKnopf : wahl.find((b) => !b.disabled) || wuerfelKnopf).focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "leiter",
    titel: "Leiterspiel",
    seite: "leiter",
    unter: "Würfle mit zwei Würfeln und nimm einen davon. Leitern bringen dich hinauf, Rutschen hinunter. Wer zuerst auf Feld 50 ist, gewinnt.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Nimmt irgendeinen Würfel" },
      einfach: { name: "Einfach", sterne: 1, satz: "Nimmt meist den grösseren" },
      mittel: { name: "Mittel", sterne: 2, satz: "Schaut auf Leitern und Rutschen" },
      schwer: { name: "Schwer", sterne: 3, satz: "Denkt einen Wurf weiter" },
    },
    texte: { start: "würfle!", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    satz,
    vorlesen: (b) => `${b.namen?.a || "a"} ist auf Feld ${b.lage.ort.a || "Start"}, ${b.namen?.b || "b"} auf Feld ${b.lage.ort.b || "Start"}.`,
    fuerPruefung: { BRETTER, ZIEL, wurf, ziel, brettNr },
  });
})();
