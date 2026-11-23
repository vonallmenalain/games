/*
 * schatzkarte.js – Schatzkarte & Kompass: zusammen einen Schatz finden.
 * ---------------------------------------------------------------------------
 * Die Seite /schatzkarte. Ein Spiel miteinander (gemeinsam): Beide gewinnen
 * oder verlieren zusammen.
 *
 * Eine hat die Karte: Sie sieht die ganze Insel – den Schatz (✕), die
 * Felsen und die versteckten Gruben – und wo die andere gerade steht. Die
 * andere sucht: Sie sieht nur die Insel und ihre eigenen Spuren. Abwechselnd
 * gibt die Kartenleserin einen Hinweis (einen Pfeil oder «Graben!»), und die
 * Sucherin macht einen Schritt oder gräbt. Ein Felsen hält auf; wer in eine
 * Grube fällt, muss zurück zum Start. Wird der Schatz ausgegraben, bevor
 * die Schritte ausgehen, ist es geschafft.
 *
 * Wer eine Partie beginnt, hat die Karte; von Partie zu Partie wechselt
 * das. Die Insel kommt aus der Saat der Partie – gegen den Computer je nach
 * Stufe grösser, mit mehr Gruben und weniger Schritten übrig.
 *
 * Züge, durch Punkte getrennt: «HN» (Hinweis: nach Norden – N, O, S, W
 * oder G für «Graben!»), «SN» (Schritt nach Norden), «SG» (graben).
 *
 * Gegen den Computer ist er der Partner: Er hält sich genau an jeden
 * Hinweis – und gibt selbst den kürzesten sicheren Weg an.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "schatzkarte") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  // Grösse, Felsen, Gruben, Schritte mehr als der kürzeste Weg.
  const INSELN = {
    leicht: { n: 5, felsen: 3, gruben: 2, luft: 8 },
    einfach: { n: 6, felsen: 5, gruben: 3, luft: 7 },
    mittel: { n: 7, felsen: 7, gruben: 5, luft: 5 },
    schwer: { n: 8, felsen: 10, gruben: 7, luft: 4 },
  };
  const DUELL = INSELN.einfach;
  const RICHTUNG = { N: [-1, 0], O: [0, 1], S: [1, 0], W: [0, -1] };
  const PFEIL = { N: "↑", O: "→", S: "↓", W: "←", G: "⛏" };
  const NAME = { N: "nach oben", O: "nach rechts", S: "nach unten", W: "nach links", G: "Graben!" };

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

  // Der kürzeste Weg von a nach b, der nicht über Felsen und Gruben führt
  // (Breitensuche) – als Liste von Feldern, oder null.
  function weg(insel, von, nach) {
    const { n, fels, grube } = insel;
    const vorher = new Map([[von, -1]]);
    const schlange = [von];
    while (schlange.length) {
      const f = schlange.shift();
      if (f === nach) break;
      const r = Math.floor(f / n); const c = f % n;
      for (const [dr, dc] of Object.values(RICHTUNG)) {
        const rr = r + dr; const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const g = rr * n + cc;
        if (vorher.has(g) || fels.has(g) || grube.has(g)) continue;
        vorher.set(g, f);
        schlange.push(g);
      }
    }
    if (!vorher.has(nach)) return null;
    const pfad = [];
    for (let f = nach; f !== -1; f = vorher.get(f)) pfad.unshift(f);
    return pfad;
  }

  // Eine Insel aus der Saat: Start in einer Ecke, der Schatz weit weg, und
  // es gibt immer einen sicheren Weg.
  const inselZwischen = new Map();
  function insel(saat, stufe) {
    const art = INSELN[stufe] || DUELL;
    const schluessel = `${saat}|${stufe || ""}`;
    if (inselZwischen.has(schluessel)) return inselZwischen.get(schluessel);
    const rnd = wuerfel((Number(saat) ^ 0x5a7c) >>> 0);
    const n = art.n;
    for (let versuch = 0; versuch < 200; versuch += 1) {
      const ecke = Math.floor(rnd() * 4);
      const start = [0, n - 1, n * (n - 1), n * n - 1][ecke];
      const frei = [...Array(n * n).keys()].filter((f) => f !== start);
      const ziehe = () => frei.splice(Math.floor(rnd() * frei.length), 1)[0];
      // Der Schatz: mindestens so weit weg wie die halbe Insel.
      const weit = frei.filter((f) => Math.abs(Math.floor(f / n) - Math.floor(start / n)) + Math.abs((f % n) - (start % n)) >= n - 1);
      const schatz = weit[Math.floor(rnd() * weit.length)];
      frei.splice(frei.indexOf(schatz), 1);
      const fels = new Set(); const grube = new Set();
      for (let i = 0; i < art.felsen; i += 1) fels.add(ziehe());
      for (let i = 0; i < art.gruben; i += 1) grube.add(ziehe());
      const i = { n, start, schatz, fels, grube };
      const pfad = weg(i, start, schatz);
      if (!pfad) continue;
      // Gruben dürfen nicht direkt neben dem Start liegen.
      i.schritte = pfad.length - 1 + 1 + art.luft; // Weg, dazu das Graben, dazu Luft
      i.kurz = pfad.length - 1;
      // Auch als Listen: Eine Menge übersteht kein JSON (die Prüfung im
      // Browser liest die Lage so).
      i.felsen = [...fels];
      i.gruben = [...grube];
      inselZwischen.set(schluessel, i);
      return i;
    }
    // Zur Not: eine leere Insel.
    const leerInsel = { n, start: 0, schatz: n * n - 1, fels: new Set(), grube: new Set(), felsen: [], gruben: [], schritte: 2 * n + art.luft, kurz: 2 * n - 2 };
    inselZwischen.set(schluessel, leerInsel);
    return leerInsel;
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt, saat, stufe }) {
    const i = insel(saat, stufe);
    const leser = beginnt;
    const sucher = anderer(beginnt);
    const l = {
      insel: i,
      leser,
      sucher,
      pos: i.start,
      uebrig: i.schritte,
      phase: "hinweis",
      dran: leser,
      ende: null,
      hinweis: null,
      spur: [i.start],
      gesehen: { fels: [], grube: [], leer: [] },
      ereignis: null,
    };
    const kaputt = () => ({ ...l, dran: null, kaputt: true });
    for (const z of zuege) {
      if (l.ende) return kaputt();
      if (l.phase === "hinweis") {
        const m = /^H([NOSWG])$/.exec(z);
        if (!m) return kaputt();
        l.hinweis = m[1];
        l.phase = "schritt";
        l.dran = sucher;
        l.ereignis = null;
        continue;
      }
      const m = /^S([NOSWG])$/.exec(z);
      if (!m) return kaputt();
      l.uebrig -= 1;
      if (m[1] === "G") {
        if (l.pos === i.schatz) { l.ende = "g"; l.ereignis = "schatz"; } else { l.gesehen.leer.push(l.pos); l.ereignis = "leer"; }
      } else {
        const [dr, dc] = RICHTUNG[m[1]];
        const r = Math.floor(l.pos / i.n) + dr; const c = (l.pos % i.n) + dc;
        const ziel = r >= 0 && c >= 0 && r < i.n && c < i.n ? r * i.n + c : -1;
        if (ziel < 0) l.ereignis = "wasser";
        else if (i.fels.has(ziel)) { l.ereignis = "fels"; if (!l.gesehen.fels.includes(ziel)) l.gesehen.fels.push(ziel); }
        else if (i.grube.has(ziel)) {
          l.ereignis = "grube";
          if (!l.gesehen.grube.includes(ziel)) l.gesehen.grube.push(ziel);
          l.pos = i.start;
          l.spur.push(ziel, i.start);
        } else { l.pos = ziel; l.spur.push(ziel); l.ereignis = "schritt"; }
      }
      if (!l.ende && l.uebrig <= 0) l.ende = "v";
      l.phase = "hinweis";
      l.dran = l.ende ? null : leser;
    }
    if (l.ende) l.dran = null;
    return l;
  }

  function darf(l, zug, sitz) {
    if (l.dran !== sitz) return false;
    if (l.phase === "hinweis") return /^H[NOSWG]$/.test(zug);
    return /^S[NOSWG]$/.test(zug);
  }

  // --- Der Computer (als Partner) -------------------------------------------------
  function besterHinweis(l) {
    const i = l.insel;
    if (l.pos === i.schatz) return "G";
    const pfad = weg(i, l.pos, i.schatz);
    if (!pfad || pfad.length < 2) return "G";
    const [r0, c0] = [Math.floor(pfad[0] / i.n), pfad[0] % i.n];
    const [r1, c1] = [Math.floor(pfad[1] / i.n), pfad[1] % i.n];
    return Object.keys(RICHTUNG).find((k) => RICHTUNG[k][0] === r1 - r0 && RICHTUNG[k][1] === c1 - c0);
  }

  function computer(l, sitz) {
    if (l.dran !== sitz) return null;
    if (l.phase === "hinweis") return { zug: `H${besterHinweis(l)}`, warte: 1100 };
    return { zug: `S${l.hinweis || "G"}`, warte: 900 };
  }

  // --- Was über der Insel steht ------------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende) return null;
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    const vorher = { fels: "Autsch – ein Felsen! ", grube: "Plumps – eine Grube! Zurück zum Start. ", leer: "Hier ist nichts. ", wasser: "Da ist Wasser! " }[l.ereignis] || "";
    // Ganz am Anfang: wer beginnt (und die Karte hat).
    if (!l.hinweis && l.phase === "hinweis") {
      if (l.dran === ich) return { text: "Du beginnst – du hast die Karte: Zeig, wohin es geht!", sitz: ich };
      return { text: modus === "computer" ? "Der Computer beginnt – er hat die Karte" : `${name(l.dran)} ist dran und hat die Karte`, sitz: l.dran };
    }
    if (l.phase === "hinweis") {
      if (l.dran === ich) return { text: `${vorher}Du hast die Karte: Zeig, wohin es geht!`, sitz: ich };
      return { text: `${vorher}${er(l.dran)} schaut auf die Karte …`, sitz: l.dran };
    }
    if (l.dran === ich) return { text: `Hinweis: ${NAME[l.hinweis]} – du gehst!`, sitz: ich };
    return { text: `${er(l.dran)} geht …`, sitz: l.dran };
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-sk-held");
    const muster = ["", "", "fels", "", "", "", "", "", "x", "", "", "", "", "", "grube", "", ""];
    for (let k = 0; k < 16; k += 1) bild.append(el("span", `zw-sk-held-feld${muster[k] ? ` ist-${muster[k]}` : ""}`));
    bild.append(el("span", "zw-sk-held-kompass", "🧭"));
    return bild;
  }

  function brett({ zug, ton, knopf, ruhig }) {
    const knoten = el("div", "zw-sk");
    const kopf = el("div", "zw-sk-kopf");
    const rolle = el("span", "zw-sk-rolle");
    const schritte = el("span", "zw-sk-schritte");
    kopf.append(rolle, schritte);
    const meer = el("div", "zw-sk-meer");
    const feld = el("div", "zw-sk-feld");
    meer.append(feld);
    const pfeile = el("div", "zw-sk-pfeile");
    const knoepfe = {};
    for (const k of ["N", "W", "G", "O", "S"]) {
      const b = knopf(PFEIL[k], `zw-sk-pfeil ist-${k}`, () => klick(k));
      b.setAttribute("aria-label", NAME[k]);
      knoepfe[k] = b;
      pfeile.append(b);
    }
    knoten.append(kopf, meer, pfeile);

    let jetzt = null;
    let groesse = 0;
    let zellen = [];
    let gesehen = -1;

    function klick(k) {
      const b = jetzt;
      if (!b || b.aus || !b.ich || b.lage.dran !== b.ich) return;
      zug(`${b.lage.phase === "hinweis" ? "H" : "S"}${k}`);
    }

    function bauen(n) {
      feld.innerHTML = "";
      feld.style.setProperty("--n", String(n));
      zellen = [];
      for (let f = 0; f < n * n; f += 1) {
        const z = el("span", "zw-sk-zelle");
        zellen.push(z);
        feld.append(z);
      }
      groesse = n;
    }

    function zeichne(b) {
      if (!b) return;
      jetzt = b;
      const l = b.lage;
      const i = l.insel;
      if (groesse !== i.n) bauen(i.n);
      const ich = b.ich;
      // Wer die Karte hat, sieht alles. Wer zuschaut, auch.
      const karte = !ich || ich === l.leser || Boolean(l.ende);
      knoten.classList.toggle("ist-karte", karte);
      const spur = new Set(l.spur);
      zellen.forEach((z, f) => {
        const teile = ["zw-sk-zelle"];
        if (karte && i.fels.has(f)) teile.push("ist-fels");
        else if (l.gesehen.fels.includes(f)) teile.push("ist-fels", "ist-entdeckt");
        if (karte && i.grube.has(f)) teile.push("ist-grube");
        else if (l.gesehen.grube.includes(f)) teile.push("ist-grube", "ist-entdeckt");
        if (karte && f === i.schatz) teile.push("ist-schatz");
        if (l.gesehen.leer.includes(f)) teile.push("ist-gegraben");
        if (spur.has(f)) teile.push("ist-spur");
        if (f === i.start) teile.push("ist-start");
        if (f === l.pos) teile.push("ist-hier", `ist-${l.sucher}`);
        if (l.ende === "g" && f === i.schatz) teile.push("ist-gefunden");
        z.className = teile.join(" ");
      });
      // Der Hinweis: gross über der Insel.
      meer.dataset.hinweis = l.phase === "schritt" && l.hinweis ? PFEIL[l.hinweis] : "";
      meer.classList.toggle("ist-hinweis", Boolean(meer.dataset.hinweis));
      rolle.textContent = !ich ? "" : ich === l.leser ? "🗺️ Du hast die Karte" : "🧭 Du suchst den Schatz";
      schritte.textContent = `Noch ${l.uebrig} ${l.uebrig === 1 ? "Schritt" : "Schritte"}`;
      schritte.classList.toggle("ist-knapp", l.uebrig <= 3 && !l.ende);
      // Die Knöpfe: wer dran ist. Beim Hinweis leuchtet nichts vor, beim
      // Schritt der Pfeil des Hinweises.
      const meinZug = Boolean(!b.aus && ich && l.dran === ich);
      for (const [k, knopfK] of Object.entries(knoepfe)) {
        knopfK.disabled = !meinZug;
        knopfK.classList.toggle("ist-empfohlen", meinZug && l.phase === "schritt" && l.hinweis === k);
      }
      pfeile.classList.toggle("ist-aus", !meinZug);
      pfeile.dataset.phase = l.phase;
      knoten.classList.toggle("ist-dran", meinZug);
      // Ein Ton je Schritt.
      const n = b.zuege.length;
      if (gesehen >= 0 && n > gesehen && !l.ende) {
        if (l.ereignis === "grube") ton("platsch");
        else if (l.ereignis === "fels" || l.ereignis === "wasser") ton("klack");
        else if (l.phase === "schritt") ton("tipp");
        else ton("klack");
      }
      gesehen = n;
      void ruhig;
    }

    return {
      knoten,
      zeichne,
      fokus: () => Object.values(knoepfe).find((k) => !k.disabled)?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "schatzkarte",
    titel: "Schatzkarte & Kompass",
    seite: "schatzkarte",
    unter: "Zusammen! Eine hat die Karte und zeigt den Weg, die andere sucht den Schatz – vorbei an Felsen und versteckten Gruben.",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Kleine Insel", sterne: 0, satz: "Wenig Gruben, viele Schritte" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Grösser, mehr Gruben" },
      schwer: { name: "Grosse Insel", sterne: 3, satz: "Kaum Schritte übrig" },
    },
    texte: { start: "zeig, wohin es geht", geschafft: "Schatz gefunden – zusammen geschafft!", verpasst: "Die Schritte sind aus – der Schatz bleibt versteckt." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie: () => ({ saat: Math.floor(Math.random() * 4294967295) }),
  });
})();
