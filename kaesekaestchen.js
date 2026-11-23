/*
 * kaesekaestchen.js – Käsekästchen: Striche ziehen, Kästchen schliessen.
 * ---------------------------------------------------------------------------
 * Die Seite /kaesekaestchen. Ein Feld aus 5 × 5 Punkten, also 4 × 4
 * Kästchen und 40 Strichen. Abwechselnd zieht jede einen Strich zwischen
 * zwei Nachbarpunkten. Wer die vierte Seite eines Kästchens zieht, bekommt
 * es – und zieht nochmal. Sind alle Striche gezogen, gewinnt, wer mehr
 * Kästchen hat; acht zu acht ist unentschieden.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen das Feld, die Regeln und der Computer.
 *
 * Die Striche sind nummeriert: 0–19 waagrecht (Zeile für Zeile, je vier),
 * 20–39 senkrecht (Zeile für Zeile, je fünf). Eine Partie steht als Text,
 * die Nummern durch Punkte getrennt: «12.27.3…».
 *
 * Wer eröffnet (a), zieht in Koralle, das Gegenüber (b) in Gold.
 *
 * Der Computer:
 *
 *   leicht    zieht irgendwo und lässt ein fertiges Kästchen meist liegen
 *   einfach   nimmt ein Kästchen meist, passt manchmal auf, keine dritte
 *             Seite hinzulegen
 *   mittel    nimmt fast jedes Kästchen, legt meist keine dritte Seite hin
 *             und gibt dann oft die kürzeste Kette her
 *   schwer    nimmt jedes Kästchen, legt keine dritte Seite hin, solange es
 *             geht, gibt dann die kürzeste Kette her – und rechnet das Ende
 *             ganz durch (wer wann eine Kette hergeben muss), sobald noch
 *             15 Striche übrig sind
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "kaesekaestchen") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const G = 4;                       // Kästchen je Seite
  const WAAG = (G + 1) * G;          // 20 waagrechte Striche
  const LINIEN = 2 * (G + 1) * G;    // 40
  const KAESTCHEN = G * G;           // 16
  const GENAU_AB = 15;               // so viele offene Striche rechnet «schwer» ganz durch

  const waag = (r, c) => r * G + c;
  const senk = (r, c) => WAAG + r * (G + 1) + c;
  // Die vier Seiten jedes Kästchens, und die Kästchen an jedem Strich.
  const SEITEN = Array.from({ length: KAESTCHEN }, (_, k) => {
    const r = Math.floor(k / G);
    const c = k % G;
    return [waag(r, c), waag(r + 1, c), senk(r, c), senk(r, c + 1)];
  });
  const AN = Array.from({ length: LINIEN }, (_, l) => SEITEN.map((s, k) => (s.includes(l) ? k : -1)).filter((k) => k >= 0));
  // Wo ein Strich liegt: Zeile, Spalte, Richtung.
  const ORT = Array.from({ length: LINIEN }, (_, l) => (l < WAAG
    ? { r: Math.floor(l / G), c: l % G, h: true }
    : { r: Math.floor((l - WAAG) / (G + 1)), c: (l - WAAG) % (G + 1), h: false }));
  const ZWEI_HOCH = Array.from({ length: LINIEN }, (_, l) => 2 ** l);

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt }) {
    const gezogen = new Array(LINIEN).fill("");
    const besitz = new Array(KAESTCHEN).fill("");
    const punkte = { a: 0, b: 0 };
    let dran = beginnt;
    let letzter = -1;
    let neu = [];
    for (const z of zuege) {
      const l = /^([1-3]?\d)$/.test(z) ? Number(z) : -1;
      if (l < 0 || l >= LINIEN || gezogen[l]) return { gezogen, besitz, punkte, dran: null, ende: null, kaputt: true, letzter, neu };
      gezogen[l] = dran;
      letzter = l;
      neu = AN[l].filter((k) => SEITEN[k].every((x) => gezogen[x]));
      neu.forEach((k) => { besitz[k] = dran; });
      punkte[dran] += neu.length;
      if (!neu.length) dran = anderer(dran);
    }
    const fertig = gezogen.every(Boolean);
    const ende = !fertig ? null : punkte.a > punkte.b ? "a" : punkte.b > punkte.a ? "b" : "u";
    return { gezogen, besitz, punkte, dran: ende ? null : dran, ende, letzter, neu, nochmal: neu.length > 0 && !ende };
  }

  const darf = (l, zug, sitz) => l.dran === sitz && /^([1-3]?\d)$/.test(zug) && Number(zug) < LINIEN && !l.gezogen[Number(zug)];

  // --- Der Computer -------------------------------------------------------------
  const offen = (gez) => { const aus = []; for (let l = 0; l < LINIEN; l += 1) if (!gez[l]) aus.push(l); return aus; };
  const seitenVon = (gez, k) => SEITEN[k].filter((x) => gez[x]).length;
  // Schliesst dieser Strich ein Kästchen?
  const schliesst = (gez, l) => AN[l].some((k) => seitenVon(gez, k) === 3);
  // Legt er eine dritte Seite hin (und gibt dem anderen ein Kästchen)?
  const gibtHer = (gez, l) => AN[l].some((k) => seitenVon(gez, k) === 2);
  const wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];

  // Wie viele Kästchen bekommt der andere, wenn ich l ziehe und er dann
  // alles nimmt, was sich schliessen lässt?
  function hergeben(gez, l) {
    const g = gez.map(Boolean);
    g[l] = true;
    let zahl = 0;
    let weiter = true;
    while (weiter) {
      weiter = false;
      for (let x = 0; x < LINIEN; x += 1) {
        if (g[x] || !AN[x].some((k) => SEITEN[k].filter((s) => g[s] || s === x).length === 4)) continue;
        g[x] = true;
        zahl += AN[x].filter((k) => SEITEN[k].every((s) => g[s])).length;
        weiter = true;
      }
    }
    return zahl;
  }

  // Das Ende genau: der beste Unterschied (eigene minus fremde Kästchen) für
  // den, der dran ist – über die Kästchen, die noch zu holen sind. Der Wert
  // hängt nur davon ab, welche Striche schon liegen (merk).
  function loese(g, maske, merk) {
    const da = merk.get(maske);
    if (da !== undefined) return da;
    let best = -Infinity;
    for (let l = 0; l < LINIEN; l += 1) {
      if (g[l]) continue;
      g[l] = 1;
      let gewinn = 0;
      for (const k of AN[l]) if (SEITEN[k].every((s) => g[s])) gewinn += 1;
      const wert = gewinn ? gewinn + loese(g, maske + ZWEI_HOCH[l], merk) : -loese(g, maske + ZWEI_HOCH[l], merk);
      g[l] = 0;
      if (wert > best) best = wert;
    }
    const aus = best === -Infinity ? 0 : best;
    merk.set(maske, aus);
    return aus;
  }
  function genau(gez) {
    const g = gez.map((x) => (x ? 1 : 0));
    let maske = 0;
    g.forEach((x, l) => { if (x) maske += ZWEI_HOCH[l]; });
    const merk = new Map();
    let best = -Infinity;
    let beste = [];
    for (const l of offen(gez)) {
      g[l] = 1;
      let gewinn = 0;
      for (const k of AN[l]) if (SEITEN[k].every((s) => g[s])) gewinn += 1;
      const wert = gewinn ? gewinn + loese(g, maske + ZWEI_HOCH[l], merk) : -loese(g, maske + ZWEI_HOCH[l], merk);
      g[l] = 0;
      if (wert > best) { best = wert; beste = [l]; } else if (wert === best) beste.push(l);
    }
    return wahl(beste);
  }

  function computer(l, sitz, stufe) {
    const gez = l.gezogen;
    const alle = offen(gez);
    if (!alle.length) return null;
    const nehmen = alle.filter((x) => schliesst(gez, x));
    const sicher = alle.filter((x) => !schliesst(gez, x) && !gibtHer(gez, x));
    const kleinsteKette = () => {
      let min = Infinity;
      let beste = [];
      for (const x of alle) {
        const n = hergeben(gez, x);
        if (n < min) { min = n; beste = [x]; } else if (n === min) beste.push(x);
      }
      return wahl(beste);
    };
    let zug;
    if (stufe === "leicht") {
      const sonst = alle.filter((x) => !nehmen.includes(x));
      zug = nehmen.length && Math.random() < 0.25 ? wahl(nehmen) : wahl(sonst.length ? sonst : alle);
    } else if (stufe === "einfach") {
      if (nehmen.length && Math.random() < 0.85) zug = wahl(nehmen);
      else if (sicher.length && Math.random() < 0.5) zug = wahl(sicher);
      else zug = wahl(alle);
    } else if (stufe === "mittel") {
      if (nehmen.length && Math.random() < 0.95) zug = wahl(nehmen);
      else if (sicher.length && Math.random() < 0.7) zug = wahl(sicher);
      else zug = Math.random() < 0.5 ? kleinsteKette() : wahl(alle);
    } else if (alle.length <= GENAU_AB) {
      zug = genau(gez);
    } else if (nehmen.length) zug = wahl(nehmen);
    else if (sicher.length) zug = wahl(sicher);
    else zug = kleinsteKette();
    return String(zug);
  }

  // --- Was über dem Feld steht ------------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran) return null;
    if (l.nochmal) {
      const wieviel = l.neu.length === 2 ? "Zwei Kästchen!" : "Kästchen!";
      if (l.dran === ich) return { text: `${wieviel} Du darfst nochmal.`, sitz: ich };
      return { text: modus === "computer" ? `${wieviel} Der Computer darf nochmal` : `${wieviel} ${name(l.dran)} darf nochmal`, sitz: l.dran };
    }
    return null;
  }

  // --- Das Bild -------------------------------------------------------------------
  // Ein Punkt, ein Strich, ein Kästchen: in Prozent der Brettbreite. Der Rand
  // ist RAND %, ein Kästchen SCHRITT %.
  const RAND = 7;
  const SCHRITT = (100 - 2 * RAND) / G;
  const pos = (n) => `${(RAND + n * SCHRITT).toFixed(3)}%`;

  function held() {
    const bild = el("div", "zw-kk-held");
    // 3 × 3 Kästchen: eines gehört a, eines b, ein paar Striche.
    const striche = [[0, 0, "h", "a"], [0, 1, "h", "b"], [1, 0, "h", "a"], [0, 0, "v", "b"], [0, 1, "v", "a"], [1, 1, "v", "b"], [0, 2, "v", "a"], [1, 1, "h", "b"], [2, 1, "h", "a"], [1, 2, "v", "b"]];
    bild.append(el("span", "zw-kk-held-box ist-a"), el("span", "zw-kk-held-box ist-b"));
    for (const [r, c, art, sitz] of striche) {
      const s = el("span", `zw-kk-held-strich ist-${art} ist-${sitz}`);
      s.style.setProperty("--r", String(r));
      s.style.setProperty("--c", String(c));
      bild.append(s);
    }
    for (let r = 0; r <= 3; r += 1) for (let c = 0; c <= 3; c += 1) {
      const p = el("span", "zw-kk-held-punkt");
      p.style.setProperty("--r", String(r));
      p.style.setProperty("--c", String(c));
      bild.append(p);
    }
    return bild;
  }

  function brett({ zug, ton }) {
    const knoten = el("div", "zw-kk");
    const stand = el("div", "zw-kk-stand");
    const zahl = { a: el("span", "zw-kk-zahl ist-a"), b: el("span", "zw-kk-zahl ist-b") };
    stand.append(zahl.a, el("span", "zw-kk-stand-mitte", "Kästchen"), zahl.b);
    const feld = el("div", "zw-kk-feld");
    feld.setAttribute("role", "group");
    feld.setAttribute("aria-label", "Das Feld mit den Strichen");
    const boxen = SEITEN.map((_, k) => {
      const b = el("span", "zw-kk-box");
      b.style.left = pos(k % G);
      b.style.top = pos(Math.floor(k / G));
      b.style.width = `${SCHRITT}%`;
      b.style.height = `${SCHRITT}%`;
      feld.append(b);
      return b;
    });
    const striche = ORT.map((o, l) => {
      const s = el("button", `zw-kk-linie ${o.h ? "ist-h" : "ist-v"}`);
      s.type = "button";
      s.dataset.linie = String(l);
      s.style.left = pos(o.c);
      s.style.top = pos(o.r);
      s.style.setProperty("--s", `${SCHRITT}%`);
      s.addEventListener("click", () => zug(String(l)));
      feld.append(s);
      return s;
    });
    for (let r = 0; r <= G; r += 1) for (let c = 0; c <= G; c += 1) {
      const p = el("span", "zw-kk-punkt");
      p.style.left = pos(c);
      p.style.top = pos(r);
      feld.append(p);
    }
    knoten.append(stand, feld);

    let gezeigt = null; // was schon gezeichnet ist: «nr|roh»

    function zeichne({ lage: l, roh, nr, ich, dran, aus, namen }) {
      const meinZug = Boolean(!aus && ich && dran === ich);
      const neuePartie = !gezeigt || gezeigt.nr !== nr || !roh.startsWith(gezeigt.roh);
      const dazu = neuePartie ? [] : roh.slice(gezeigt.roh.length).split(".").filter(Boolean);
      l.gezogen.forEach((wer, i) => {
        const s = striche[i];
        s.className = `zw-kk-linie ${ORT[i].h ? "ist-h" : "ist-v"}${wer ? ` ist-gezogen ist-${wer}` : ""}${i === l.letzter && !l.ende ? " ist-letzter" : ""}${dazu.includes(String(i)) ? " ist-neu" : ""}`;
        s.disabled = Boolean(wer) || !meinZug;
        const o = ORT[i];
        s.setAttribute("aria-label", `${o.h ? "Waagrechter" : "Senkrechter"} Strich, Zeile ${o.r + 1}, Spalte ${o.c + 1}${wer ? ", gezogen" : ""}`);
      });
      const neuBoxen = neuePartie ? [] : (dazu.length ? l.neu : []);
      l.besitz.forEach((wer, k) => {
        boxen[k].className = `zw-kk-box${wer ? ` ist-${wer}` : ""}${neuBoxen.includes(k) ? " ist-neu" : ""}`;
      });
      zahl.a.textContent = `${namen?.a || "a"}: ${l.punkte.a}`;
      zahl.b.textContent = `${namen?.b || "b"}: ${l.punkte.b}`;
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      if (dazu.length) ton(neuBoxen.length ? "treffer" : "tipp");
      gezeigt = { nr, roh };
    }

    return {
      knoten,
      zeichne,
      fokus: () => striche.find((s) => !s.disabled)?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "kaesekaestchen",
    titel: "Käsekästchen",
    seite: "kaesekaestchen",
    unter: "Zieht abwechselnd Striche zwischen den Punkten. Wer ein Kästchen schliesst, bekommt es und zieht nochmal. Wer am Ende mehr Kästchen hat, gewinnt.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Kennt jeden Trick mit den Ketten" },
    },
    texte: { start: "tippe zwischen zwei Punkte", remis: "Unentschieden – gleich viele Kästchen." },
    lage,
    darf,
    brett,
    computer,
    // Was der Lautsprecher beim Satz noch vorliest: der Stand.
    vorlesen: (b) => `Stand: ${b.namen?.a || "a"} ${b.lage.punkte.a}, ${b.namen?.b || "b"} ${b.lage.punkte.b}`,
    satz,
  });
})();
