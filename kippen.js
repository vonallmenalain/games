/*
 * kippen.js – Steine kippen: einklemmen und umdrehen.
 * ---------------------------------------------------------------------------
 * Die Seite /kippen. Ein Brett mit 8 × 8 Feldern, in der Mitte liegen zu
 * Beginn vier Steine über Kreuz. Wer dran ist, setzt einen Stein so, dass
 * er in einer Linie – waagrecht, senkrecht oder schräg – Steine der anderen
 * zwischen sich und einem eigenen Stein einklemmt. Alle eingeklemmten
 * Steine kippen: Sie bekommen die eigene Farbe. Wo das geht, zeigt ein
 * Punkt.
 *
 * Kann jemand nicht setzen, setzt er aus, und die andere ist nochmal dran.
 * Können beide nicht mehr, ist die Partie aus: Wer mehr Steine hat,
 * gewinnt; gleich viele ist unentschieden.
 *
 * Die Felder sind 0 bis 63, zeilenweise von oben links. Ein Zug ist die
 * Nummer des Felds, getrennt durch Punkte – Aussetzen braucht keinen Zug,
 * das rechnet lage selbst.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen nur das Brett, die Regeln und der Computer.
 *
 * Der Computer:
 *
 *   leicht    setzt irgendwohin, wo es geht
 *   einfach   kippt meist möglichst viele Steine
 *   mittel    weiss, dass Ecken und Ränder viel wert sind, und schaut
 *             einen Zug voraus
 *   schwer    schaut vier Züge voraus (Alpha-Beta), am Ende ganz
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "kippen") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const N = 8;
  const RICHTUNGEN = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const anfang = () => {
    const b = Array(N * N).fill("");
    b[27] = "b"; b[28] = "a"; b[35] = "a"; b[36] = "b";
    return b;
  };

  // Welche Steine kippen, wenn sitz auf f setzt (leer: kein erlaubter Zug).
  function kippt(brett, f, sitz) {
    if (brett[f]) return [];
    const r = Math.floor(f / N); const c = f % N;
    const gegner = anderer(sitz);
    const alle = [];
    for (const [dr, dc] of RICHTUNGEN) {
      const linie = [];
      let nr = r + dr; let nc = c + dc;
      while (nr >= 0 && nr < N && nc >= 0 && nc < N && brett[nr * N + nc] === gegner) { linie.push(nr * N + nc); nr += dr; nc += dc; }
      if (linie.length && nr >= 0 && nr < N && nc >= 0 && nc < N && brett[nr * N + nc] === sitz) alle.push(...linie);
    }
    return alle;
  }
  const moeglich = (brett, sitz) => brett.map((_, f) => f).filter((f) => !brett[f] && kippt(brett, f, sitz).length);
  const zaehle = (brett) => ({ a: brett.filter((x) => x === "a").length, b: brett.filter((x) => x === "b").length });

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt }) {
    const brett = anfang();
    let dran = beginnt;
    let ende = null;
    let letzter = null;
    let aussetzen = null;
    const fertig = () => {
      const p = zaehle(brett);
      return p.a > p.b ? "a" : p.b > p.a ? "b" : "u";
    };
    for (const z of zuege) {
      const f = Number(z);
      const weg = Number.isInteger(f) && String(f) === String(z) && f >= 0 && f < N * N ? kippt(brett, f, dran) : [];
      if (ende || !weg.length) return { brett, dran: null, ende: ende || null, kaputt: true, letzter, aussetzen, punkte: zaehle(brett), moeglich: [], zahl: zuege.length };
      brett[f] = dran;
      weg.forEach((k) => { brett[k] = dran; });
      letzter = { feld: f, sitz: dran, gekippt: weg };
      aussetzen = null;
      const naechste = anderer(dran);
      if (moeglich(brett, naechste).length) dran = naechste;
      else if (moeglich(brett, dran).length) aussetzen = naechste;
      else ende = fertig();
    }
    return {
      brett,
      dran: ende ? null : dran,
      ende,
      letzter,
      aussetzen,
      punkte: zaehle(brett),
      moeglich: ende ? [] : moeglich(brett, dran),
      zahl: zuege.length,
    };
  }

  const darf = (l, z, sitz) => Boolean(l.dran === sitz && /^(?:0|[1-9]\d?)$/.test(z) && l.moeglich.includes(Number(z)));

  // --- Der Computer -------------------------------------------------------------
  const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

  // Was ein Feld wert ist: Ecken viel, Ränder etwas, die Felder neben einer
  // leeren Ecke wenig (sie schenken die Ecke her).
  const GEWICHT = [
    100, -20, 10, 5, 5, 10, -20, 100,
    -20, -40, -2, -2, -2, -2, -40, -20,
    10, -2, 1, 1, 1, 1, -2, 10,
    5, -2, 1, 0, 0, 1, -2, 5,
    5, -2, 1, 0, 0, 1, -2, 5,
    10, -2, 1, 1, 1, 1, -2, 10,
    -20, -40, -2, -2, -2, -2, -40, -20,
    100, -20, 10, 5, 5, 10, -20, 100,
  ];
  const ECKE_NEBEN = { 1: 0, 8: 0, 9: 0, 6: 7, 15: 7, 14: 7, 48: 56, 57: 56, 49: 56, 55: 63, 62: 63, 54: 63 };

  function wert(brett, ich) {
    const du = anderer(ich);
    let w = 0;
    for (let f = 0; f < 64; f += 1) {
      if (!brett[f]) continue;
      let g = GEWICHT[f];
      // Liegt die Ecke schon, ist das Feld daneben nicht mehr schlecht.
      if (ECKE_NEBEN[f] !== undefined && brett[ECKE_NEBEN[f]]) g = 5;
      w += brett[f] === ich ? g : -g;
    }
    const zugIch = moeglich(brett, ich).length;
    const zugDu = moeglich(brett, du).length;
    return w + 6 * (zugIch - zugDu);
  }

  function setze(brett, f, sitz) {
    const b = [...brett];
    b[f] = sitz;
    kippt(brett, f, sitz).forEach((k) => { b[k] = sitz; });
    return b;
  }

  function suche(brett, dran, ich, tiefe, alpha, beta, gepasst = false) {
    const zuege = moeglich(brett, dran);
    if (!zuege.length) {
      if (gepasst) { const p = zaehle(brett); const d = p[ich] - p[anderer(ich)]; return d * 1000; }
      return suche(brett, anderer(dran), ich, tiefe, alpha, beta, true);
    }
    if (tiefe === 0) return wert(brett, ich);
    const kinder = zuege.map((f) => ({ f, b: setze(brett, f, dran) }));
    kinder.sort((x, y) => GEWICHT[y.f] - GEWICHT[x.f]);
    let best = dran === ich ? -Infinity : Infinity;
    for (const { b } of kinder) {
      const w = suche(b, anderer(dran), ich, tiefe - 1, alpha, beta);
      if (dran === ich) { if (w > best) best = w; if (best > alpha) alpha = best; } else { if (w < best) best = w; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    return best;
  }

  function computer(l, sitz, stufe) {
    const zuege = l.moeglich;
    if (!zuege.length || l.dran !== sitz) return null;
    let f;
    if (stufe === "leicht") f = zufall(zuege);
    else if (stufe === "einfach") {
      const viel = Math.max(...zuege.map((x) => kippt(l.brett, x, sitz).length));
      f = Math.random() < 0.7 ? zufall(zuege.filter((x) => kippt(l.brett, x, sitz).length === viel)) : zufall(zuege);
    } else {
      const frei = l.brett.filter((x) => !x).length;
      const tiefe = stufe === "mittel" ? 2 : frei <= 10 ? 10 : 4;
      let best = -Infinity;
      let beste = [];
      for (const x of zuege) {
        const w = suche(setze(l.brett, x, sitz), anderer(sitz), sitz, tiefe - 1, -Infinity, Infinity);
        if (w > best) { best = w; beste = [x]; } else if (w === best) beste.push(x);
      }
      f = stufe === "mittel" && Math.random() < 0.15 ? zufall(zuege) : zufall(beste);
    }
    return { zug: String(f), warte: 700 + Math.random() * 300 + 70 * (l.letzter?.gekippt.length || 0) };
  }

  // --- Was über dem Brett steht ---------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran) return null;
    const wer = (sitz) => (modus === "computer" && sitz === "b" ? "Der Computer" : name(sitz));
    if (l.aussetzen) {
      if (l.aussetzen === ich) return { text: `Du kannst nirgends setzen – ${wer(l.dran)} ist nochmal dran.`, sitz: l.dran };
      if (l.dran === ich) return { text: `${wer(l.aussetzen)} muss aussetzen – du bist nochmal dran!`, sitz: ich };
    }
    return null;
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-kp-held");
    const muster = ["", "", "", "", "", "a", "b", "", "", "b", "a", "a", "", "", "", ""];
    muster.forEach((sitz) => {
      const z = el("span", "zw-kp-held-feld");
      if (sitz) z.append(el("span", `zw-kp-stein ist-${sitz}`));
      bild.append(z);
    });
    return bild;
  }

  function brett({ zug, ton, ruhig }) {
    const knoten = el("div", "vr-feld zw-kp");
    knoten.dataset.zuege = "0";
    const stand = el("div", "zw-kp-stand");
    const zahl = { a: el("span", "zw-kp-zahl ist-a"), b: el("span", "zw-kp-zahl ist-b") };
    stand.append(zahl.a, el("span", "zw-kp-stand-mitte", "Steine"), zahl.b);
    const gitter = el("div", "zw-kp-gitter");
    gitter.setAttribute("role", "group");
    gitter.setAttribute("aria-label", "Das Brett");
    const felder = [];
    for (let f = 0; f < 64; f += 1) {
      const k = el("button", "zw-kp-feld");
      k.type = "button";
      k.dataset.feld = String(f);
      const stein = el("span", "zw-kp-stein");
      stein.setAttribute("aria-hidden", "true");
      k.append(stein);
      k.addEventListener("click", () => zug(String(f)));
      felder.push(k);
      gitter.append(k);
    }
    knoten.append(stand, gitter);

    let gezeigt = { nr: -1, zahl: -1 };

    function zeichne({ lage: l, nr, ich, dran, aus, namen }) {
      const meinZug = Boolean(!aus && ich && dran === ich && !l.ende);
      const neu = nr === gezeigt.nr && l.zahl === gezeigt.zahl + 1 && l.letzter && !ruhig();
      const gekippt = new Map((neu ? l.letzter.gekippt : []).map((f, i) => [f, i]));
      const punkte = new Set(meinZug ? l.moeglich : []);
      felder.forEach((k, f) => {
        const s = l.brett[f];
        const stein = k.firstChild;
        const war = stein.dataset.sitz || "";
        stein.className = `zw-kp-stein${s ? ` ist-${s}` : ""}`;
        stein.dataset.sitz = s;
        if (neu && gekippt.has(f) && war && war !== s) {
          stein.style.setProperty("--verzug", `${80 + gekippt.get(f) * 70}ms`);
          stein.classList.add("ist-kippt");
        }
        if (neu && f === l.letzter.feld) stein.classList.add("ist-neu");
        k.classList.toggle("ist-letzter", Boolean(l.letzter && f === l.letzter.feld && !l.ende));
        k.classList.toggle("ist-moeglich", punkte.has(f));
        k.disabled = !punkte.has(f);
        k.setAttribute("aria-label", `Feld ${"abcdefgh"[f % 8]}${8 - Math.floor(f / 8)}${s ? `, ${namen?.[s] || s}` : punkte.has(f) ? ", hier kannst du setzen" : ", frei"}`);
      });
      zahl.a.textContent = `${namen?.a || "a"}: ${l.punkte.a}`;
      zahl.b.textContent = `${namen?.b || "b"}: ${l.punkte.b}`;
      if (neu) ton(l.letzter.gekippt.length >= 4 ? "treffer" : "klack");
      gezeigt = { nr, zahl: l.zahl };
      knoten.dataset.zuege = String(l.zahl);
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.classList.toggle("ist-sieg-a", l.ende === "a");
      knoten.classList.toggle("ist-sieg-b", l.ende === "b");
    }

    return {
      knoten,
      zeichne,
      fokus: () => (felder.find((k) => !k.disabled) || felder[27]).focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "kippen",
    titel: "Steine kippen",
    seite: "kippen",
    unter: "Setze so, dass du Steine der anderen zwischen dir und einem eigenen Stein einklemmst – sie kippen in deine Farbe. Wer am Ende mehr Steine hat, gewinnt.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Kennt den Wert der Ecken" },
      schwer: { name: "Schwer", sterne: 3, satz: "Schaut weit voraus" },
    },
    texte: { start: "tippe auf einen Punkt", remis: "Unentschieden – gleich viele Steine." },
    lage,
    darf,
    brett,
    computer,
    satz,
    vorlesen: (b) => `Steine: ${b.namen?.a || "a"} ${b.lage.punkte.a}, ${b.namen?.b || "b"} ${b.lage.punkte.b}`,
    fuerPruefung: { kippt, moeglich, anfang, GEWICHT },
  });
})();
