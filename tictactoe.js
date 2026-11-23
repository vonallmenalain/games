/*
 * tictactoe.js – Tic Tac Toe: drei in einer Reihe, auf neun Feldern.
 * ---------------------------------------------------------------------------
 * Die Seite /tictactoe. Abwechselnd ein Zeichen in ein freies Feld; wer zuerst
 * drei in einer Reihe hat – waagrecht, senkrecht oder schräg –, gewinnt. Sind
 * alle Felder voll, ist es unentschieden.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen nur das Brett, die Regeln und der Computer.
 *
 * Wer eröffnet (a), hat das Kreuz in Koralle, das Gegenüber (b) den Kreis in
 * Gold – das bleibt so, auch wenn von Partie zu Partie der andere beginnt.
 * Eine Partie steht als Text: die Felder der Züge, der Reihe nach (0 bis 8,
 * zeilenweise von oben links), ein Zeichen je Zug.
 *
 * Der Computer:
 *
 *   leicht    setzt irgendwohin und lässt eine fertige Reihe fast immer liegen
 *   einfach   nimmt eine fertige Reihe meist, hält eine Drohung manchmal auf
 *   mittel    gewinnt und hält auf, wann immer es geht; sonst Mitte und
 *             Ecken, ab und zu irgendwohin
 *   schwer    rechnet alles durch (Minimax) – gegen ihn ist ein
 *             Unentschieden schon ein Erfolg
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "tictactoe") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const REIHEN = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  // --- Die Regeln -----------------------------------------------------------------
  // Das Brett aus den Zügen: wer wo steht (a, b oder ""), wer dran ist, wie
  // es ausging, und welche Reihe gewonnen hat.
  function lage(zuege, { beginnt }) {
    const brett = Array(9).fill("");
    let dran = beginnt;
    let ende = null;
    let reihe = null;
    for (const z of zuege) {
      const f = Number(z);
      if (ende || !(f >= 0 && f <= 8) || brett[f]) return { brett, dran: null, ende: ende || null, kaputt: true, reihe };
      brett[f] = dran;
      reihe = REIHEN.find((r) => r.every((i) => brett[i] === dran)) || null;
      if (reihe) ende = dran;
      else if (brett.every(Boolean)) ende = "u";
      dran = anderer(dran);
    }
    return { brett, dran: ende ? null : dran, ende, reihe, letzter: zuege.length ? Number(zuege[zuege.length - 1]) : -1 };
  }

  const frei = (brett) => brett.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
  const gewinnt = (brett, f, sitz) => REIHEN.some((r) => r.includes(f) && r.every((i) => (i === f ? sitz : brett[i]) === sitz));

  // --- Der Computer -------------------------------------------------------------
  // Minimax über alle Züge, bis zum Ende: +10 für einen Sieg, früher ist
  // besser; -10 für eine Niederlage, später ist besser. Dieselbe Stellung
  // kommt auf vielen Wegen vor – gerechnet wird sie einmal (merk, je Zug des
  // Computers: Von seiner Stellung aus ist die Tiefe einer Stellung immer
  // dieselbe).
  function minimax(brett, sitz, ich, tiefe, merk) {
    const schluessel = brett.map((x) => x || "-").join("");
    if (merk.has(schluessel)) return merk.get(schluessel);
    const offen = frei(brett);
    let best = sitz === ich ? -Infinity : Infinity;
    if (!offen.length) best = 0;
    for (const f of offen) {
      brett[f] = sitz;
      const wert = gewinnt(brett, f, sitz)
        ? (sitz === ich ? 10 - tiefe : tiefe - 10)
        : minimax(brett, anderer(sitz), ich, tiefe + 1, merk);
      brett[f] = "";
      best = sitz === ich ? Math.max(best, wert) : Math.min(best, wert);
    }
    merk.set(schluessel, best);
    return best;
  }

  const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

  function computer(l, sitz, stufe) {
    const brett = [...l.brett];
    const offen = frei(brett);
    if (!offen.length) return null;
    const sieg = offen.filter((f) => gewinnt(brett, f, sitz));
    const gefahr = offen.filter((f) => gewinnt(brett, f, anderer(sitz)));
    if (stufe === "leicht") {
      // Eine fertige Reihe nimmt er fast nie – lieber irgendein anderes Feld.
      if (sieg.length && Math.random() < 0.1) return String(sieg[0]);
      const sonst = offen.filter((f) => !sieg.includes(f));
      return String(zufall(sonst.length ? sonst : offen));
    }
    if (stufe === "einfach") {
      if (sieg.length && Math.random() < 0.75) return String(sieg[0]);
      if (gefahr.length && Math.random() < 0.45) return String(gefahr[0]);
      return String(zufall(offen));
    }
    if (stufe === "mittel") {
      if (sieg.length) return String(sieg[0]);
      if (gefahr.length) return String(gefahr[0]);
      if (Math.random() < 0.25) return String(zufall(offen));
      const gut = [4, 0, 2, 6, 8].filter((f) => offen.includes(f));
      return String(gut.length ? zufall(gut.slice(0, gut[0] === 4 ? 1 : gut.length)) : zufall(offen));
    }
    // schwer: alles durchrechnen, unter gleich guten zufällig.
    if (offen.length === 9) return String(zufall([0, 2, 4, 6, 8]));
    const merk = new Map();
    let best = -Infinity;
    let beste = [];
    for (const f of offen) {
      brett[f] = sitz;
      const wert = gewinnt(brett, f, sitz) ? 10 : minimax(brett, anderer(sitz), sitz, 1, merk);
      brett[f] = "";
      if (wert > best) { best = wert; beste = [f]; } else if (wert === best) beste.push(f);
    }
    return String(zufall(beste));
  }

  // --- Das Bild ---------------------------------------------------------------------
  // Ein Kreuz oder ein Kreis als SVG – gezeichnet, als würde der Stift gerade
  // darübergehen.
  const NS = "http://www.w3.org/2000/svg";
  function zeichenSvg(sitz, klasse = "") {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", `zw-ttt-zeichen ist-${sitz} ${klasse}`.trim());
    svg.setAttribute("aria-hidden", "true");
    const strich = (d) => {
      const p = document.createElementNS(NS, "path");
      p.setAttribute("d", d);
      p.setAttribute("pathLength", "1");
      svg.append(p);
    };
    if (sitz === "a") { strich("M24 24 L76 76"); strich("M76 24 L24 76"); }
    else strich("M50 20 a30 30 0 1 1 -0.01 0");
    return svg;
  }

  function held() {
    const bild = el("div", "zw-ttt-held");
    const muster = ["a", "", "b", "", "a", "b", "", "", "a"];
    muster.forEach((sitz) => {
      const f = el("span", "zw-ttt-held-feld");
      if (sitz) f.append(zeichenSvg(sitz));
      bild.append(f);
    });
    return bild;
  }

  // Die Gewinnlinie liegt als SVG über dem Brett: 300 × 300 Einheiten, der
  // Rand und die Fugen sind je 2 % breit (wie im Stylesheet), ein Feld also
  // 92 Einheiten, von Mitte zu Mitte 98.
  const mitte = (i) => 3 + 98 * (i + 0.5);

  function brett({ zug, ton, ruhig }) {
    const knoten = el("div", "vr-feld zw-ttt");
    const gitter = el("div", "zw-ttt-gitter");
    gitter.setAttribute("role", "group");
    gitter.setAttribute("aria-label", "Die neun Felder");
    const linie = document.createElementNS(NS, "svg");
    linie.setAttribute("viewBox", "0 0 300 300");
    linie.setAttribute("class", "zw-ttt-linie");
    linie.setAttribute("aria-hidden", "true");
    const strich = document.createElementNS(NS, "path");
    strich.setAttribute("pathLength", "1");
    linie.append(strich);
    const felder = [];
    for (let i = 0; i < 9; i += 1) {
      const k = el("button", "zw-ttt-feld");
      k.type = "button";
      k.dataset.feld = String(i);
      k.addEventListener("click", () => zug(String(i)));
      k.addEventListener("keydown", (e) => {
        if (/^[1-9]$/.test(e.key)) { e.preventDefault(); zug(String(Number(e.key) - 1)); return; }
        const schritt = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
        if (!schritt) return;
        const ziel = i + schritt;
        const ausserhalb = ziel < 0 || ziel > 8 || (Math.abs(schritt) === 1 && Math.floor(ziel / 3) !== Math.floor(i / 3));
        e.preventDefault();
        if (!ausserhalb) felder[ziel].focus();
      });
      felder.push(k);
      gitter.append(k);
    }
    knoten.append(gitter, linie);

    // Was schon gezeichnet ist: die Züge der Partie, als Text.
    const zustand = { roh: null, nr: -1, beginnt: "a" };

    function zeichne({ lage: l, roh, nr, beginnt, ich, dran, aus }) {
      const neuePartie = nr !== zustand.nr || beginnt !== zustand.beginnt || zustand.roh === null || !roh.startsWith(zustand.roh);
      if (neuePartie) {
        felder.forEach((f) => { f.innerHTML = ""; });
        zustand.roh = "";
      }
      // Kommen viele Zeichen auf einmal (das erste Bild, ein Neuladen),
      // stehen sie einfach da – nur ein einzelner neuer Zug wird gezeichnet.
      const neu = [...roh.slice(zustand.roh.length)].map(Number);
      const zeichnen = neu.length === 1 && !ruhig();
      neu.forEach((f) => {
        const sitz = l.brett[f];
        if (!sitz || !felder[f]) return;
        felder[f].innerHTML = "";
        felder[f].append(zeichenSvg(sitz, zeichnen ? "ist-neu" : ""));
      });
      if (neu.length === 1) ton("tipp");
      Object.assign(zustand, { roh, nr, beginnt });

      const meinZug = Boolean(!aus && dran && ich && dran === ich);
      l.brett.forEach((sitz, i) => {
        const f = felder[i];
        f.classList.toggle("ist-voll", Boolean(sitz));
        f.classList.toggle("ist-letzter", i === l.letzter && !l.ende);
        f.classList.toggle("ist-sieg", Boolean(l.reihe?.includes(i)));
        f.disabled = Boolean(sitz) || !meinZug;
        f.setAttribute("aria-label", `Feld ${i + 1}, ${sitz ? (sitz === "a" ? "Kreuz" : "Kreis") : "frei"}`);
      });
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-aus", Boolean(l.ende && l.ende !== "u"));

      // Die Gewinnlinie: durch die Mitten der drei Felder, ein Stück darüber
      // hinaus.
      if (l.reihe && l.ende && l.ende !== "u") {
        const [von, , bis] = l.reihe;
        const x1 = mitte(von % 3); const y1 = mitte(Math.floor(von / 3));
        const x2 = mitte(bis % 3); const y2 = mitte(Math.floor(bis / 3));
        const laenge = Math.hypot(x2 - x1, y2 - y1);
        const dx = ((x2 - x1) / laenge) * 34; const dy = ((y2 - y1) / laenge) * 34;
        const weg = `M${(x1 - dx).toFixed(1)} ${(y1 - dy).toFixed(1)} L${(x2 + dx).toFixed(1)} ${(y2 + dy).toFixed(1)}`;
        if (strich.getAttribute("d") !== weg) strich.setAttribute("d", weg);
        linie.setAttribute("class", `zw-ttt-linie ist-an ist-${l.ende}`);
      } else {
        strich.removeAttribute("d");
        linie.setAttribute("class", "zw-ttt-linie");
      }
    }

    return {
      knoten,
      zeichne,
      fokus: () => (felder.find((f) => !f.disabled) || felder[4]).focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "tictactoe",
    titel: "Tic Tac Toe",
    seite: "tictactoe",
    unter: "Kreuz oder Kreis, abwechselnd ein Feld. Wer zuerst drei in einer Reihe hat – waagrecht, senkrecht oder schräg –, gewinnt.",
    held,
    trenner: "",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Unschlagbar – schaffst du ein Unentschieden?" },
    },
    texte: { start: "tippe auf ein Feld", remis: "Unentschieden – kein Feld mehr frei." },
    lage,
    darf: (l, z, sitz) => l.dran === sitz && /^[0-8]$/.test(z) && !l.brett[Number(z)],
    brett,
    computer,
    zeichen: (sitz) => zeichenSvg(sitz, "ist-mini"),
  });
})();
