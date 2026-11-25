/*
 * bohnen.js – Bohnen säen: Mulden, Bohnen und zwei Töpfe.
 * ---------------------------------------------------------------------------
 * Die Seite /bohnen. Ein Holzbrett mit zwei Reihen zu sechs Mulden, in jeder
 * vier Bohnen, und an den Enden je ein Topf. Die untere Reihe und der Topf
 * rechts gehören dir, die obere Reihe und der Topf links dem Gegenüber.
 *
 * Wer dran ist, nimmt alle Bohnen aus einer eigenen Mulde und legt sie
 * einzeln in die nächsten Mulden – gegen den Uhrzeiger: nach rechts, in den
 * eigenen Topf, oben weiter nach links. Den Topf des Gegenübers überspringt
 * man.
 *
 *   - Landet die letzte Bohne im eigenen Topf, darf man nochmal.
 *   - Landet sie in einer eigenen leeren Mulde, und gegenüber liegen Bohnen,
 *     raubt man sie: Beide Häufchen kommen in den eigenen Topf.
 *   - Ist eine Reihe leer, ist die Partie aus: Die Bohnen, die noch liegen,
 *     kommen in den Topf dessen, dem die Mulde gehört.
 *
 * Wer mehr Bohnen im Topf hat, gewinnt; 24 zu 24 ist unentschieden.
 *
 * Die Mulden sind gezählt wie die Bohnen wandern: 0 bis 5 die Reihe von a
 * (unten, von links), 6 der Topf von a, 7 bis 12 die Reihe von b (von
 * rechts oben nach links), 13 der Topf von b. Die Mulde gegenüber von i ist
 * 12 − i. Ein Zug ist die Nummer der Mulde, die man leert («3»), getrennt
 * durch Punkte. Auf dem Gerät von b ist das Brett gedreht: Die eigene Reihe
 * liegt immer unten.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen nur das Brett, die Regeln und der Computer.
 *
 * Der Computer:
 *
 *   leicht    nimmt irgendeine Mulde
 *   einfach   nimmt meist eine Mulde, deren letzte Bohne im Topf landet,
 *             sonst oft die, die am meisten bringt
 *   mittel    schaut einen Zug des Gegenübers voraus, ab und zu nicht
 *   schwer    rechnet acht Züge voraus (Minimax mit Alpha-Beta)
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "bohnen") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const START = 4;
  const TOPF = { a: 6, b: 13 };
  const REIHE = { a: [0, 1, 2, 3, 4, 5], b: [7, 8, 9, 10, 11, 12] };
  const ALLE = START * 12;
  const besitzer = (i) => (i >= 0 && i <= 6 ? "a" : i >= 7 && i <= 13 ? "b" : null);
  const istMulde = (i) => Number.isInteger(i) && i >= 0 && i <= 12 && i !== 6;
  const gegenueber = (i) => 12 - i;
  const summe = (m, sitz) => REIHE[sitz].reduce((s, i) => s + m[i], 0);

  // --- Die Regeln -----------------------------------------------------------------
  // Ein Zug auf den Mulden m (wird nicht verändert): wohin die Bohnen
  // wandern, ob die letzte im Topf liegt, was geraubt wird, ob es aus ist.
  function schritt(m, f, sitz) {
    const n = [...m];
    let hand = n[f];
    n[f] = 0;
    let i = f;
    const weg = [];
    while (hand > 0) {
      i = (i + 1) % 14;
      if (i === TOPF[anderer(sitz)]) continue;
      n[i] += 1;
      hand -= 1;
      weg.push(i);
    }
    let nochmal = i === TOPF[sitz];
    let raub = null;
    if (!nochmal && besitzer(i) === sitz && n[i] === 1 && n[gegenueber(i)] > 0) {
      const zahl = n[gegenueber(i)] + 1;
      raub = { von: i, gegen: gegenueber(i), zahl, topf: TOPF[sitz] };
      n[TOPF[sitz]] += zahl;
      n[i] = 0;
      n[gegenueber(i)] = 0;
    }
    let rest = null;
    let ende = null;
    if (summe(n, "a") === 0 || summe(n, "b") === 0) {
      rest = { a: summe(n, "a"), b: summe(n, "b") };
      for (const s of ["a", "b"]) {
        REIHE[s].forEach((j) => { n[j] = 0; });
        n[TOPF[s]] += rest[s];
      }
      ende = n[6] > n[13] ? "a" : n[13] > n[6] ? "b" : "u";
      nochmal = false;
    }
    return { m: n, weg, nochmal, raub, rest, ende };
  }

  function anfang() {
    const m = Array(14).fill(START);
    m[TOPF.a] = 0;
    m[TOPF.b] = 0;
    return m;
  }

  // Das Brett aus den Zügen: wie viele Bohnen wo liegen, wer dran ist, wie
  // es ausging – und was der letzte Zug tat (für das Bild und die Sätze).
  function lage(zuege, { beginnt }) {
    let m = anfang();
    let dran = beginnt;
    let ende = null;
    let letzter = null;
    let vorher = null;
    for (const z of zuege) {
      const f = Number(z);
      if (ende || String(f) !== String(z) || !istMulde(f) || besitzer(f) !== dran || !m[f]) {
        return { mulden: m, dran: null, ende: ende || null, kaputt: true, letzter, vorher, punkte: { a: m[6], b: m[13] }, zahl: zuege.length };
      }
      vorher = m;
      const s = schritt(m, f, dran);
      m = s.m;
      letzter = { mulde: f, sitz: dran, weg: s.weg, nochmal: s.nochmal, raub: s.raub, rest: s.rest };
      if (s.ende) ende = s.ende;
      else if (!s.nochmal) dran = anderer(dran);
    }
    return {
      mulden: m,
      dran: ende ? null : dran,
      ende,
      letzter,
      vorher,
      nochmal: Boolean(letzter?.nochmal && !ende),
      punkte: { a: m[6], b: m[13] },
      zahl: zuege.length,
    };
  }

  const darf = (l, z, sitz) => Boolean(l.dran === sitz && /^(?:0|[1-9]\d?)$/.test(z) && istMulde(Number(z))
    && besitzer(Number(z)) === sitz && l.mulden[Number(z)] > 0);

  // --- Der Computer -------------------------------------------------------------
  const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];
  const moeglich = (m, sitz) => REIHE[sitz].filter((i) => m[i] > 0);

  // Wie gut eine Stellung für ich ist: der Unterschied der Töpfe – am Ende
  // dazu viel für den Sieg. Unterwegs zählen die Bohnen auf der eigenen
  // Seite ein wenig (sie kommen am Ende in den eigenen Topf, wenn das
  // Gegenüber zuerst leer ist).
  function wert(m, ich, ende) {
    const du = anderer(ich);
    const d = m[TOPF[ich]] - m[TOPF[du]];
    if (ende) return d + (ende === ich ? 1000 : ende === "u" ? 0 : -1000);
    return d + 0.15 * (summe(m, ich) - summe(m, du));
  }

  // Minimax mit Alpha-Beta. Wer nochmal darf, zieht nochmal – die Tiefe zählt
  // jeden Zug. Züge mit «nochmal» und Raub zuerst: Dann schneidet die Suche
  // früher ab.
  function suche(m, dran, ich, tiefe, alpha, beta) {
    const zuege = moeglich(m, dran);
    if (!zuege.length || tiefe === 0) return wert(m, ich, null);
    const folgen = zuege.map((f) => ({ f, s: schritt(m, f, dran) }))
      .sort((x, y) => (Number(y.s.nochmal) - Number(x.s.nochmal)) || ((y.s.raub?.zahl || 0) - (x.s.raub?.zahl || 0)));
    let best = dran === ich ? -Infinity : Infinity;
    for (const { s } of folgen) {
      const w = s.ende ? wert(s.m, ich, s.ende) : suche(s.m, s.nochmal ? dran : anderer(dran), ich, tiefe - 1, alpha, beta);
      if (dran === ich) { best = Math.max(best, w); alpha = Math.max(alpha, w); } else { best = Math.min(best, w); beta = Math.min(beta, w); }
      if (alpha >= beta) break;
    }
    return best;
  }

  function besteZuege(m, sitz, tiefe) {
    let best = -Infinity;
    let beste = [];
    for (const f of moeglich(m, sitz)) {
      const s = schritt(m, f, sitz);
      const w = s.ende ? wert(s.m, sitz, s.ende) : suche(s.m, s.nochmal ? sitz : anderer(sitz), sitz, tiefe - 1, -Infinity, Infinity);
      if (w > best + 1e-9) { best = w; beste = [f]; } else if (Math.abs(w - best) <= 1e-9) beste.push(f);
    }
    return beste;
  }

  // Wie lange das Säen des letzten Zugs zu sehen ist (wie im Bild unten):
  // So lange wartet der Computer, bevor er selbst zieht.
  const proBohne = (weg) => Math.max(110, Math.min(220, 1600 / Math.max(1, weg.length)));
  function saeDauer(letzter) {
    if (!letzter) return 0;
    return 260 + letzter.weg.length * proBohne(letzter.weg) + (letzter.raub ? 520 : 0) + (letzter.rest ? 560 : 0);
  }

  function computer(l, sitz, stufe) {
    const m = l.mulden;
    const offen = moeglich(m, sitz);
    if (!offen.length) return null;
    let f;
    if (stufe === "leicht") f = zufall(offen);
    else if (stufe === "einfach") {
      const topf = offen.filter((i) => schritt(m, i, sitz).nochmal);
      if (topf.length && Math.random() < 0.7) f = zufall(topf);
      else if (Math.random() < 0.45) {
        const gewinn = (i) => { const s = schritt(m, i, sitz); return s.m[TOPF[sitz]] - m[TOPF[sitz]]; };
        const best = Math.max(...offen.map(gewinn));
        f = zufall(offen.filter((i) => gewinn(i) === best));
      } else f = zufall(offen);
    } else if (stufe === "mittel") {
      f = Math.random() < 0.2 ? zufall(offen) : zufall(besteZuege(m, sitz, 2));
    } else f = zufall(besteZuege(m, sitz, 8));
    // Erst ziehen, wenn das Säen davor zu sehen war.
    return { zug: String(f), warte: Math.min(3200, saeDauer(l.letzter) + 650 + Math.random() * 300) };
  }

  // --- Was über dem Brett steht ---------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran || !l.letzter) return null;
    const wer = (sitz) => (modus === "computer" && sitz === "b" ? "der Computer" : name(sitz));
    const Wer = (sitz) => { const w = wer(sitz); return w.charAt(0).toUpperCase() + w.slice(1); };
    const { sitz, raub, nochmal } = l.letzter;
    if (nochmal) {
      if (sitz === ich) return { text: "Die letzte Bohne liegt in deinem Topf – du darfst nochmal!", sitz };
      return { text: `Die letzte Bohne liegt im Topf – ${wer(sitz)} darf nochmal.`, sitz };
    }
    if (raub) {
      if (sitz === ich) return { text: `Geraubt! ${raub.zahl} Bohnen in deinen Topf. ${Wer(l.dran)} ist dran.`, sitz: l.dran };
      if (l.dran === ich) return { text: `${Wer(sitz)} hat ${raub.zahl} Bohnen geraubt – du bist dran.`, sitz: l.dran };
      return { text: `${Wer(sitz)} hat ${raub.zahl} Bohnen geraubt. ${Wer(l.dran)} ist dran.`, sitz: l.dran };
    }
    return null;
  }

  // --- Das Bild -------------------------------------------------------------------
  // Wo die Bohnen in einer Mulde liegen: die ersten acht fest verteilt (so
  // lassen sich wenige gut zählen), dann eine Spirale (wie
  // Sonnenblumenkerne), ab der einundzwanzigsten eine zweite Lage darüber.
  // In Prozent der Mulde.
  const ERSTE = [[38, 42], [62, 40], [50, 62], [30, 64], [70, 62], [50, 24], [26, 40], [74, 40]];
  const LAGE = Array.from({ length: 40 }, (_, j) => {
    const dreh = ((j * 47) % 180) - 90;
    const farbe = (j * 7 + Math.floor(j / 3)) % 4;
    if (j < ERSTE.length) return { x: ERSTE[j][0], y: ERSTE[j][1], dreh, farbe };
    const schicht = j < 20 ? 0 : 1;
    const k = schicht ? j - 20 : j - ERSTE.length;
    const r = schicht ? 8 + 22 * Math.sqrt((k + 0.5) / 20) : 16 + 16 * Math.sqrt((k + 0.5) / 12);
    const w = k * 2.39996 + 0.7 + schicht * 1.3;
    return { x: 50 + r * Math.cos(w), y: 50 + r * Math.sin(w) - schicht * 5, dreh, farbe };
  });
  // Im Topf: höher als breit, also eine gestreckte Spirale.
  const LAGE_TOPF = Array.from({ length: 60 }, (_, j) => {
    const schicht = Math.floor(j / 24);
    const k = j % 24;
    const r = Math.sqrt((k + 0.4) / 24);
    const w = k * 2.39996 + schicht * 0.9;
    return { x: 50 + 30 * r * Math.cos(w), y: 50 + 38 * r * Math.sin(w) - schicht * 3, dreh: ((j * 53) % 180) - 90, farbe: (j * 5 + schicht) % 4 };
  });

  function bohnenSetzen(ort, n, topf) {
    const lagen = topf ? LAGE_TOPF : LAGE;
    const sichtbar = Math.min(n, lagen.length);
    while (ort.childElementCount > sichtbar) ort.lastElementChild.remove();
    while (ort.childElementCount < sichtbar) {
      const j = ort.childElementCount;
      const p = lagen[j];
      const b = el("span", `zw-bs-bohne ist-f${p.farbe}`);
      b.style.left = `${p.x.toFixed(1)}%`;
      b.style.top = `${p.y.toFixed(1)}%`;
      b.style.setProperty("--dreh", `${p.dreh}deg`);
      ort.append(b);
    }
  }

  function held() {
    const bild = el("div", "zw-bs-held");
    bild.append(el("span", "zw-bs-held-topf ist-links"));
    [[2, 1, 3], [4, 0, 2]].forEach((reihe, r) => reihe.forEach((n, c) => {
      const mulde = el("span", "zw-bs-held-mulde");
      mulde.style.setProperty("--r", String(r));
      mulde.style.setProperty("--c", String(c));
      for (let j = 0; j < n; j += 1) {
        const p = LAGE[j];
        const b = el("span", `zw-bs-bohne ist-f${p.farbe}`);
        b.style.left = `${p.x.toFixed(1)}%`;
        b.style.top = `${p.y.toFixed(1)}%`;
        b.style.setProperty("--dreh", `${p.dreh}deg`);
        mulde.append(b);
      }
      bild.append(mulde);
    }));
    const topf = el("span", "zw-bs-held-topf ist-rechts");
    for (let j = 0; j < 7; j += 1) {
      const p = LAGE_TOPF[j];
      const b = el("span", `zw-bs-bohne ist-f${p.farbe}`);
      b.style.left = `${p.x.toFixed(1)}%`;
      b.style.top = `${p.y.toFixed(1)}%`;
      b.style.setProperty("--dreh", `${p.dreh}deg`);
      topf.append(b);
    }
    bild.append(topf);
    return bild;
  }

  // Wo eine Mulde im Raster steht (8 Spalten, 2 Zeilen), wenn «unten» unten
  // sitzt: die eigene Reihe unten von links nach rechts, der eigene Topf
  // rechts, die andere Reihe oben von rechts nach links, ihr Topf links.
  function platz(i, unten) {
    const oben = anderer(unten);
    if (i === TOPF[unten]) return { spalte: "8", zeile: "1 / span 2" };
    if (i === TOPF[oben]) return { spalte: "1", zeile: "1 / span 2" };
    const k = REIHE[besitzer(i)].indexOf(i);
    return besitzer(i) === unten ? { spalte: String(2 + k), zeile: "2" } : { spalte: String(7 - k), zeile: "1" };
  }

  const pause = (ms) => new Promise((weiter) => { window.setTimeout(weiter, ms); });
  const istFortsetzung = (alt, neu) => alt === neu || alt === "" || neu.startsWith(`${alt}.`);

  function brett({ zug, ton, ruhig }) {
    const knoten = el("div", "vr-feld zw-bs");
    knoten.dataset.zuege = "0";
    const feld = el("div", "zw-bs-feld");
    feld.setAttribute("role", "group");
    feld.setAttribute("aria-label", "Das Brett mit den Mulden");
    const orte = [];
    const zahlen = [];
    for (let i = 0; i < 14; i += 1) {
      const topf = i === 6 || i === 13;
      const m = topf ? el("div", "zw-bs-topf") : el("button", "zw-bs-mulde");
      if (!topf) {
        m.type = "button";
        m.dataset.mulde = String(i);
        m.addEventListener("click", () => zug(String(i)));
      } else m.dataset.topf = besitzer(i);
      m.classList.add(`ist-${besitzer(i)}`);
      const ort = el("span", "zw-bs-bohnen");
      ort.setAttribute("aria-hidden", "true");
      const zahl = el("span", "zw-bs-zahl", "0");
      zahl.setAttribute("aria-hidden", "true");
      m.append(ort, zahl);
      feld.append(m);
      orte.push(ort);
      zahlen.push(zahl);
    }
    const elemente = orte.map((o) => o.parentElement);
    knoten.append(feld);

    // Was gerade zu sehen ist: die Bohnen je Mulde, die Züge der Partie.
    const bild = { m: anfang(), unten: "a" };
    // bekannt: die Züge, die schon zu sehen sind oder gerade gesät werden
    // oder in der Warteschlange stehen.
    let bekannt = { nr: -1, roh: null, beginnt: "a", zahl: 0 };
    let warteschlange = [];
    let laeuft = false;
    let marke = 0;
    let letzte = null;
    let namen = { a: "a", b: "b" };

    function stellen(unten) {
      if (bild.unten === unten && elemente[0].style.gridColumn) return;
      bild.unten = unten;
      elemente.forEach((e, i) => {
        const p = platz(i, unten);
        e.style.gridColumn = p.spalte;
        e.style.gridRow = p.zeile;
        e.classList.toggle("ist-unten", besitzer(i) === unten);
        e.classList.toggle("ist-oben", besitzer(i) !== unten);
      });
    }

    function mulde(i, n, { plopp = false } = {}) {
      bild.m[i] = n;
      bohnenSetzen(orte[i], n, i === 6 || i === 13);
      zahlen[i].textContent = String(n);
      elemente[i].classList.toggle("ist-leer", n === 0);
      if (plopp) {
        elemente[i].classList.remove("ist-plopp");
        void elemente[i].offsetWidth;
        elemente[i].classList.add("ist-plopp");
      }
    }
    const alle = (m) => m.forEach((n, i) => mulde(i, n));

    // Knöpfe, Markierungen und Beschriftung nach dem, was gilt (letzte) –
    // solange gesät wird, ist keine Mulde frei.
    function bedienen() {
      if (!letzte) return;
      const { lage: l, ich, dran, aus } = letzte;
      const meinZug = Boolean(!laeuft && !aus && ich && dran === ich);
      for (let i = 0; i < 14; i += 1) {
        const e = elemente[i];
        const n = bild.m[i];
        const wem = besitzer(i);
        const name = wem === ich ? "deine" : `von ${namen[wem] || wem}`;
        if (i === 6 || i === 13) {
          e.setAttribute("aria-label", `Topf ${wem === ich ? "– deiner" : name}: ${n} ${n === 1 ? "Bohne" : "Bohnen"}`);
          e.setAttribute("role", "img");
          e.classList.toggle("ist-sieger", !laeuft && Boolean(l.ende && l.ende === wem));
          continue;
        }
        const waehlbar = meinZug && wem === ich && n > 0;
        e.disabled = !waehlbar;
        e.classList.toggle("ist-waehlbar", waehlbar);
        e.classList.toggle("ist-letzter", !laeuft && !l.ende && l.letzter?.mulde === i);
        const nr = REIHE[wem].indexOf(i) + 1;
        e.setAttribute("aria-label", `Mulde ${nr} ${wem === ich ? "– deine" : name}: ${n} ${n === 1 ? "Bohne" : "Bohnen"}`);
      }
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.classList.toggle("ist-saet", laeuft);
    }

    // Ein Zug, Bohne für Bohne.
    async function saeen(lk, meine) {
      const z = lk.letzter;
      const takt = proBohne(z.weg);
      alle(lk.vorher);
      elemente.forEach((e) => e.classList.remove("ist-quelle", "ist-raub", "ist-letzter"));
      elemente[z.mulde].classList.add("ist-quelle");
      ton("tipp");
      const hand = bild.m[z.mulde];
      mulde(z.mulde, 0);
      if (hand) await pause(160);
      for (const i of z.weg) {
        if (meine !== marke) return false;
        mulde(i, bild.m[i] + 1, { plopp: true });
        ton("bohne");
        await pause(takt);
      }
      if (meine !== marke) return false;
      elemente[z.mulde].classList.remove("ist-quelle");
      if (z.raub) {
        elemente[z.raub.von].classList.add("ist-raub");
        elemente[z.raub.gegen].classList.add("ist-raub");
        await pause(260);
        if (meine !== marke) return false;
        mulde(z.raub.von, 0);
        mulde(z.raub.gegen, 0);
        mulde(z.raub.topf, bild.m[z.raub.topf] + z.raub.zahl, { plopp: true });
        ton("treffer");
        await pause(260);
        elemente[z.raub.von].classList.remove("ist-raub");
        elemente[z.raub.gegen].classList.remove("ist-raub");
      }
      if (z.rest) {
        await pause(300);
        if (meine !== marke) return false;
        for (const s of ["a", "b"]) {
          REIHE[s].forEach((j) => mulde(j, 0));
          if (z.rest[s]) mulde(TOPF[s], bild.m[TOPF[s]] + z.rest[s], { plopp: true });
        }
        await pause(260);
      }
      alle(lk.mulden);
      return true;
    }

    async function abspielen() {
      if (laeuft) return;
      laeuft = true;
      const meine = marke;
      bedienen();
      while (warteschlange.length && meine === marke) {
        const { lk } = warteschlange.shift();
        const fertig = await saeen(lk, meine);
        if (!fertig || meine !== marke) break;
      }
      if (meine !== marke) return;
      laeuft = false;
      if (letzte) alle(letzte.lage.mulden);
      bedienen();
    }

    function zeichne(args) {
      letzte = args;
      if (args.namen) namen = args.namen;
      const { lage: l, roh = "", nr, beginnt, ich } = args;
      stellen(ich === "b" ? "b" : "a");
      const zuege = roh ? roh.split(".") : [];
      const neuePartie = nr !== bekannt.nr || beginnt !== bekannt.beginnt || bekannt.roh === null || !istFortsetzung(bekannt.roh, roh);
      const offen = zuege.length - bekannt.zahl;
      if (neuePartie || ruhig() || offen > 3 || offen < 0) {
        // Neu, ein Neuladen, viele Züge auf einmal: einfach hinstellen.
        marke += 1;
        warteschlange = [];
        laeuft = false;
        elemente.forEach((e) => e.classList.remove("ist-quelle", "ist-raub", "ist-plopp"));
        alle(l.mulden);
        bekannt = { nr, roh, beginnt, zahl: zuege.length };
        knoten.dataset.zuege = String(zuege.length);
        bedienen();
        return;
      }
      for (let k = bekannt.zahl + 1; k <= zuege.length; k += 1) {
        warteschlange.push({ lk: lage(zuege.slice(0, k), { beginnt }) });
      }
      bekannt = { nr, roh, beginnt, zahl: zuege.length };
      // Wie viele Züge die Partie hat (für die Prüfung im Browser) – auch
      // wenn das Säen noch läuft.
      knoten.dataset.zuege = String(zuege.length);
      if (offen > 0) abspielen();
      else bedienen();
    }

    return {
      knoten,
      zeichne,
      fokus: () => (elemente.find((e) => e.tagName === "BUTTON" && !e.disabled) || elemente[0]).focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "bohnen",
    titel: "Bohnen säen",
    seite: "bohnen",
    unter: "Nimm alle Bohnen aus einer deiner Mulden und lege sie einzeln in die nächsten. Landet die letzte in deinem Topf, darfst du nochmal. Wer am Ende mehr Bohnen im Topf hat, gewinnt.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Rechnet weit voraus" },
    },
    texte: { start: "tippe auf eine deiner Mulden unten", remis: "Unentschieden – gleich viele Bohnen in beiden Töpfen." },
    lage,
    darf,
    brett,
    computer,
    satz,
    // Was der Lautsprecher beim Satz noch vorliest: der Stand.
    vorlesen: (b) => `Im Topf: ${b.namen?.a || "a"} ${b.lage.punkte.a}, ${b.namen?.b || "b"} ${b.lage.punkte.b}`,
    // Für die Prüfung (scripts/pruefen.mjs).
    fuerPruefung: { schritt, anfang, ALLE, TOPF, REIHE, saeDauer },
  });
})();
