/*
 * brueckenschlag.js – Brückenschlag: die eigenen zwei Ränder verbinden.
 * ---------------------------------------------------------------------------
 * Die Seite /brueckenschlag. Ein Feld aus 7 × 7 Sechsecken, schräg wie eine
 * Raute. Abwechselnd setzt man einen Stein auf ein freies Feld. Koralle (a)
 * will links und rechts verbinden, Gold (b) oben und unten – die Ränder
 * haben die Farbe dessen, dem sie gehören. Wer zuerst eine Kette aus eigenen
 * Steinen von einem Rand zum anderen hat, gewinnt. Ein Unentschieden gibt
 * es nie: Ist das Feld voll, hat immer jemand gewonnen.
 *
 * Die Felder sind 0 bis 48, zeilenweise von oben links. Ein Feld (r, c) hat
 * sechs Nachbarn: links und rechts, oben (r−1, c) und (r−1, c+1), unten
 * (r+1, c−1) und (r+1, c). Ein Zug ist die Nummer des Felds, getrennt durch
 * Punkte.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen nur das Brett, die Regeln und der Computer.
 *
 * Der Computer misst, wie viele Steine jedem noch fehlen (der kürzeste Weg:
 * eigene Steine kosten nichts, freie Felder einen, fremde sind Mauern):
 *
 *   leicht    setzt irgendwohin, gern in die Mitte
 *   einfach   setzt oft dorthin, wo es ihm am meisten nützt
 *   mittel    setzt dorthin, wo der Unterschied am grössten wird
 *   schwer    spielt die besten Felder in Gedanken viele Male zu Ende
 *             und nimmt das, mit dem er am öftesten gewinnt
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "brueckenschlag") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const N = 7;
  const FELDER = N * N;
  const zeile = (f) => Math.floor(f / N);
  const spalte = (f) => f % N;
  const NACHBARN = Array.from({ length: FELDER }, (_, f) => {
    const r = zeile(f); const c = spalte(f);
    return [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, -1], [1, 0]]
      .map(([dr, dc]) => [r + dr, c + dc])
      .filter(([nr, nc]) => nr >= 0 && nr < N && nc >= 0 && nc < N)
      .map(([nr, nc]) => nr * N + nc);
  });
  // a: links (Spalte 0) nach rechts (Spalte N−1); b: oben nach unten.
  const istStart = (f, sitz) => (sitz === "a" ? spalte(f) === 0 : zeile(f) === 0);
  const istZiel = (f, sitz) => (sitz === "a" ? spalte(f) === N - 1 : zeile(f) === N - 1);

  // Eine Kette von Rand zu Rand: die Felder darauf, oder null.
  function kette(brett, sitz) {
    const vor = new Map();
    const schlange = [];
    for (let f = 0; f < FELDER; f += 1) if (brett[f] === sitz && istStart(f, sitz)) { vor.set(f, -1); schlange.push(f); }
    for (let i = 0; i < schlange.length; i += 1) {
      const f = schlange[i];
      if (istZiel(f, sitz)) {
        const weg = [];
        for (let k = f; k !== -1; k = vor.get(k)) weg.push(k);
        return weg;
      }
      for (const n of NACHBARN[f]) if (brett[n] === sitz && !vor.has(n)) { vor.set(n, f); schlange.push(n); }
    }
    return null;
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt }) {
    const brett = Array(FELDER).fill("");
    let dran = beginnt;
    let ende = null;
    let weg = null;
    let letzter = -1;
    for (const z of zuege) {
      const f = Number(z);
      if (ende || String(f) !== String(z) || !(f >= 0 && f < FELDER) || brett[f]) {
        return { brett, dran: null, ende: ende || null, kaputt: true, weg, letzter, zahl: zuege.length };
      }
      brett[f] = dran;
      letzter = f;
      weg = kette(brett, dran);
      if (weg) ende = dran;
      dran = anderer(dran);
    }
    return { brett, dran: ende ? null : dran, ende, weg, letzter, zahl: zuege.length };
  }

  const darf = (l, z, sitz) => Boolean(l.dran === sitz && /^(?:0|[1-9]\d?)$/.test(z) && Number(z) < FELDER && !l.brett[Number(z)]);

  // --- Der Computer -------------------------------------------------------------
  const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

  // Wie viele Steine sitz noch fehlen (0-1-Breitensuche): eigene Steine
  // kosten 0, freie Felder 1, fremde sind Mauern. Kein Weg: 99.
  function fehlen(brett, sitz) {
    const kosten = new Int16Array(FELDER).fill(999);
    const deque = [];
    const vorne = [];
    const gegner = anderer(sitz);
    for (let f = 0; f < FELDER; f += 1) {
      if (!istStart(f, sitz) || brett[f] === gegner) continue;
      const k = brett[f] === sitz ? 0 : 1;
      if (k < kosten[f]) { kosten[f] = k; (k ? deque : vorne).push(f); }
    }
    // Zwei Listen statt einer Doppel-Schlange: erst alle mit kleineren Kosten.
    let best = 99;
    const offen = [...vorne, ...deque];
    while (offen.length) {
      let mi = 0;
      for (let i = 1; i < offen.length; i += 1) if (kosten[offen[i]] < kosten[offen[mi]]) mi = i;
      const f = offen.splice(mi, 1)[0];
      if (istZiel(f, sitz)) { best = Math.min(best, kosten[f]); continue; }
      for (const n of NACHBARN[f]) {
        if (brett[n] === gegner) continue;
        const k = kosten[f] + (brett[n] === sitz ? 0 : 1);
        if (k < kosten[n]) { kosten[n] = k; offen.push(n); }
      }
    }
    return best;
  }

  const wert = (brett, ich) => fehlen(brett, anderer(ich)) - fehlen(brett, ich);
  const freie = (brett) => brett.map((x, f) => (x ? -1 : f)).filter((f) => f >= 0);
  const mitteNah = (f) => -Math.hypot(zeile(f) - (N - 1) / 2, spalte(f) - (N - 1) / 2 + (zeile(f) - (N - 1) / 2) * 0.5);

  function bewertet(brett, sitz) {
    return freie(brett).map((f) => {
      brett[f] = sitz;
      const w = kette(brett, sitz) ? 1000 : wert(brett, sitz);
      brett[f] = "";
      return { f, w: w + mitteNah(f) * 0.01 };
    }).sort((x, y) => y.w - x.w);
  }

  // In Gedanken zu Ende spielen: alle freien Felder zufällig verteilt, wer
  // dann eine Kette hat, gewinnt (im vollen Feld genau einer).
  function ausspielen(brett, dran, ich) {
    const b = [...brett];
    const frei = freie(b);
    for (let i = frei.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [frei[i], frei[j]] = [frei[j], frei[i]]; }
    let wer = dran;
    for (const f of frei) { b[f] = wer; wer = anderer(wer); }
    return kette(b, ich) ? 1 : 0;
  }

  function computer(l, sitz, stufe) {
    const brett = [...l.brett];
    const frei = freie(brett);
    if (!frei.length) return null;
    let f;
    if (stufe === "leicht") {
      const mitte = [...frei].sort((x, y) => mitteNah(y) - mitteNah(x)).slice(0, Math.max(6, Math.ceil(frei.length / 2)));
      f = zufall(Math.random() < 0.6 ? mitte : frei);
    } else if (stufe === "einfach") {
      const liste = bewertet(brett, sitz);
      f = Math.random() < 0.55 ? zufall(liste.slice(0, 4)).f : zufall(frei);
    } else if (stufe === "mittel") {
      const liste = bewertet(brett, sitz);
      // Was sofort gewinnt oder sofort verhindert, dass die andere gewinnt.
      const gegenSieg = frei.find((x) => { brett[x] = anderer(sitz); const s = kette(brett, anderer(sitz)); brett[x] = ""; return s; });
      if (liste[0].w >= 1000) f = liste[0].f;
      else if (gegenSieg !== undefined) f = gegenSieg;
      else f = Math.random() < 0.15 ? zufall(liste.slice(0, 5)).f : zufall(liste.filter((x) => x.w === liste[0].w)).f;
    } else {
      const liste = bewertet(brett, sitz);
      const gegenSieg = frei.find((x) => { brett[x] = anderer(sitz); const s = kette(brett, anderer(sitz)); brett[x] = ""; return s; });
      if (liste[0].w >= 1000) f = liste[0].f;
      else if (gegenSieg !== undefined) f = gegenSieg;
      else if (frei.length === FELDER) f = 24;
      else {
        const kandidaten = liste.slice(0, 10);
        let best = -1;
        for (const k of kandidaten) {
          brett[k.f] = sitz;
          let siege = 0;
          for (let i = 0; i < 400; i += 1) siege += ausspielen(brett, anderer(sitz), sitz);
          brett[k.f] = "";
          if (siege > best) { best = siege; f = k.f; }
        }
      }
    }
    return String(f);
  }

  // --- Was über dem Brett steht ---------------------------------------------------
  const ziel = (sitz) => (sitz === "a" ? "links und rechts" : "oben und unten");
  function satz(l, { ich }) {
    if (l.ende || !l.dran || l.dran !== ich || l.zahl > 1) return null;
    return l.zahl === 0
      ? { text: `Du beginnst – verbinde ${ziel(ich)}!`, sitz: ich }
      : { text: `Du bist dran – verbinde ${ziel(ich)}!`, sitz: ich };
  }

  // --- Das Bild -------------------------------------------------------------------
  // Spitze Sechsecke: Breite 1, Höhe 2/√3. Das Feld (r, c) steht bei
  // x = c + r/2, y = r · 3/4 · Höhe. In Prozent des Bretts (mit Rand).
  const H = 2 / Math.sqrt(3);
  const RAND = 0.55;
  const BREITE = N + (N - 1) / 2 + 2 * RAND;
  const HOEHE = (N - 1) * 0.75 * H + H + 2 * RAND;
  const ort = (f) => ({ x: RAND + spalte(f) + zeile(f) / 2, y: RAND + zeile(f) * 0.75 * H });

  function held() {
    const bild = el("div", "zw-bk-held");
    const muster = { 1: "a", 5: "b", 6: "a", 9: "b", 10: "a", 14: "b" };
    for (let f = 0; f < 16; f += 1) {
      const r = Math.floor(f / 4); const c = f % 4;
      const z = el("span", `zw-bk-held-feld${muster[f] ? ` ist-${muster[f]}` : ""}`);
      z.style.setProperty("--x", String(c + r / 2));
      z.style.setProperty("--y", String(r * 0.75 * H));
      bild.append(z);
    }
    return bild;
  }

  function brett({ zug, ton, ruhig }) {
    const knoten = el("div", "vr-feld zw-bk");
    knoten.dataset.zuege = "0";
    const feld = el("div", "zw-bk-feld");
    feld.style.setProperty("--breite", String(BREITE));
    feld.style.setProperty("--hoehe", String(HOEHE));
    feld.setAttribute("role", "group");
    feld.setAttribute("aria-label", "Das Feld aus Sechsecken");
    // Die Ränder: links und rechts Koralle, oben und unten Gold.
    const NS = "http://www.w3.org/2000/svg";
    const raender = document.createElementNS(NS, "svg");
    raender.setAttribute("viewBox", `0 0 ${BREITE} ${HOEHE}`);
    raender.setAttribute("class", "zw-bk-raender");
    raender.setAttribute("aria-hidden", "true");
    const ecke = (f, dx, dy) => { const o = ort(f); return [o.x + 0.5 + dx, o.y + H / 2 + dy]; };
    const linie = (punkte, klasse) => {
      const p = document.createElementNS(NS, "polyline");
      p.setAttribute("points", punkte.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(" "));
      p.setAttribute("class", klasse);
      raender.append(p);
    };
    const r0 = 0.62;
    linie([ecke(0, -0.5, -r0 * H * 0.6), ecke(N - 1, 0.5, -r0 * H * 0.6)], "ist-b");
    linie([ecke(N * (N - 1), -0.5, r0 * H * 0.6), ecke(FELDER - 1, 0.5, r0 * H * 0.6)], "ist-b");
    linie([ecke(0, -0.62, -0.2), ecke(N * (N - 1), -0.62, 0.2)], "ist-a");
    linie([ecke(N - 1, 0.62, -0.2), ecke(FELDER - 1, 0.62, 0.2)], "ist-a");
    feld.append(raender);
    const zellen = [];
    for (let f = 0; f < FELDER; f += 1) {
      const k = el("button", "zw-bk-zelle");
      k.type = "button";
      k.dataset.feld = String(f);
      const o = ort(f);
      k.style.left = `${(o.x / BREITE) * 100}%`;
      k.style.top = `${(o.y / HOEHE) * 100}%`;
      k.addEventListener("click", () => zug(String(f)));
      feld.append(k);
      zellen.push(k);
    }
    knoten.append(feld);

    let gezeigt = { nr: -1, zahl: -1 };

    function zeichne({ lage: l, nr, ich, dran, aus, namen }) {
      const meinZug = Boolean(!aus && ich && dran === ich && !l.ende);
      const neu = nr === gezeigt.nr && l.zahl === gezeigt.zahl + 1;
      const sieg = new Set(l.weg && l.ende ? l.weg : []);
      zellen.forEach((k, f) => {
        const s = l.brett[f];
        k.className = `zw-bk-zelle${s ? ` ist-${s}` : ""}${f === l.letzter && !l.ende ? " ist-letzter" : ""}${sieg.has(f) ? " ist-sieg" : ""}${neu && f === l.letzter && !ruhig() ? " ist-neu" : ""}`;
        k.disabled = Boolean(s) || !meinZug;
        k.setAttribute("aria-label", `Feld ${zeile(f) + 1}-${spalte(f) + 1}${s ? `, ${namen?.[s] || s}` : ", frei"}`);
      });
      if (neu) ton("klack");
      gezeigt = { nr, zahl: l.zahl };
      knoten.dataset.zuege = String(l.zahl);
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
    }

    return {
      knoten,
      zeichne,
      fokus: () => (zellen.find((k) => !k.disabled) || zellen[24]).focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "brueckenschlag",
    titel: "Brückenschlag",
    seite: "brueckenschlag",
    unter: "Setzt abwechselnd Steine auf die Sechsecke. Koralle verbindet links und rechts, Gold oben und unten. Wer zuerst eine Kette von Rand zu Rand hat, gewinnt – unentschieden gibt es nie.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Denkt viele Partien voraus" },
    },
    texte: { start: "verbinde deine zwei Ränder", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    satz,
    vorlesen: (b) => `${b.namen?.a || "a"} verbindet links und rechts, ${b.namen?.b || "b"} oben und unten.`,
    fuerPruefung: { N, FELDER, NACHBARN, kette, fehlen },
  });
})();
