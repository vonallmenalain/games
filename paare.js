/*
 * paare.js – Paare finden: zwei Karten aufdecken, gleiche behalten.
 * ---------------------------------------------------------------------------
 * Die Seite /paare. 24 Karten, verdeckt, zwölf Tierpaare. Wer dran ist,
 * deckt zwei Karten auf. Sind es zwei gleiche, gehören sie ihr – und sie
 * darf nochmal. Sonst werden sie wieder umgedreht, und die andere ist dran.
 * Sind alle Paare gefunden, gewinnt, wer mehr hat; sechs zu sechs ist
 * unentschieden.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen die Karten, die Regeln und der Computer.
 *
 * Wie die Karten liegen, kommt aus der Saat der Partie (stand.saat): Beide
 * Geräte mischen gleich. Ein Zug ist die Nummer einer Karte (0–23, Zeile für
 * Zeile), durch Punkte getrennt; zwei Züge sind ein Versuch.
 *
 * Der Computer merkt sich, was aufgedeckt wurde – je nach Stufe mehr oder
 * weniger gut:
 *
 *   leicht    merkt sich eine Karte nur selten
 *   einfach   merkt sich etwa jede zweite
 *   mittel    merkt sich die meisten, vergisst aber, was lange her ist
 *   schwer    vergisst nichts
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "paare") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const KARTEN = 24;
  const PAARE = KARTEN / 2;
  const TIERE = ["🐶", "🐱", "🐰", "🦊", "🐻", "🐼", "🐸", "🐵", "🦁", "🐷", "🐮", "🐔"];
  const NAMEN = ["Hund", "Katze", "Hase", "Fuchs", "Bär", "Panda", "Frosch", "Affe", "Löwe", "Schwein", "Kuh", "Huhn"];

  // Mischen mit Saat: dieselbe Saat, dieselbe Auslage.
  function auslage(saat) {
    let t = (Number(saat) >>> 0) || 1;
    const rnd = () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const karten = [];
    for (let i = 0; i < PAARE; i += 1) karten.push(i, i);
    for (let i = karten.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [karten[i], karten[j]] = [karten[j], karten[i]];
    }
    return karten;
  }

  // --- Die Regeln -----------------------------------------------------------------
  let zwischen = { schluessel: "", lage: null };

  function lage(zuege, { roh, beginnt, saat }) {
    const schluessel = `${beginnt}|${saat}|${roh}`;
    if (zwischen.schluessel === schluessel) return zwischen.lage;
    const karten = auslage(saat);
    const besitz = new Array(KARTEN).fill("");
    const punkte = { a: 0, b: 0 };
    // Wann jede Karte zuletzt offen lag (Zugnummer), für den Computer.
    const gesehen = new Array(KARTEN).fill(-1);
    let dran = beginnt;
    let offen = -1;
    let letzter = null;
    let versuche = 0;
    for (let n = 0; n < zuege.length; n += 1) {
      const z = zuege[n];
      const k = /^(1?\d|2[0-3])$/.test(z) ? Number(z) : -1;
      if (k < 0 || besitz[k] || k === offen) {
        const kaputt = { karten, besitz, punkte, dran: null, ende: null, kaputt: true, offen, letzter, gesehen, versuche };
        zwischen = { schluessel, lage: kaputt };
        return kaputt;
      }
      gesehen[k] = n;
      if (offen < 0) { offen = k; continue; }
      const paar = karten[k] === karten[offen];
      letzter = { sitz: dran, a: offen, b: k, paar };
      versuche += 1;
      if (paar) { besitz[offen] = dran; besitz[k] = dran; punkte[dran] += 1; } else dran = anderer(dran);
      offen = -1;
    }
    const fertig = punkte.a + punkte.b === PAARE;
    const ende = !fertig ? null : punkte.a > punkte.b ? "a" : punkte.b > punkte.a ? "b" : "u";
    const aus = { karten, besitz, punkte, dran: ende ? null : dran, ende, offen, letzter, gesehen, versuche, zugzahl: zuege.length };
    zwischen = { schluessel, lage: aus };
    return aus;
  }

  const darf = (l, zug, sitz) => {
    if (l.dran !== sitz || !/^(1?\d|2[0-3])$/.test(zug)) return false;
    const k = Number(zug);
    return !l.besitz[k] && k !== l.offen;
  };

  // --- Der Computer -------------------------------------------------------------
  // Was er noch weiss: jede Karte, die offen lag, behält er mit einer
  // Wahrscheinlichkeit – und je länger es her ist, desto seltener.
  const GEDAECHTNIS = { leicht: [0.25, 0.04], einfach: [0.55, 0.03], mittel: [0.7, 0.012], schwer: [1, 0] };
  const wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];

  function computer(l, sitz, stufe) {
    if (l.dran !== sitz) return null;
    const [grund, schwund] = GEDAECHTNIS[stufe] || GEDAECHTNIS.mittel;
    const jetzt = l.zugzahl;
    const offenKarten = [];
    for (let k = 0; k < KARTEN; k += 1) if (!l.besitz[k] && k !== l.offen) offenKarten.push(k);
    // Was er von jeder Karte noch weiss (gewürfelt bei jedem Zug neu: so
    // vergisst und erinnert sich auch ein Kind).
    const weiss = new Map();
    for (const k of offenKarten) {
      if (l.gesehen[k] < 0) continue;
      const p = grund - schwund * (jetzt - l.gesehen[k]);
      if (Math.random() < p) weiss.set(k, l.karten[k]);
    }
    const nieGesehen = offenKarten.filter((k) => l.gesehen[k] < 0);
    const raten = () => wahl(nieGesehen.length ? nieGesehen : offenKarten);
    let zug;
    if (l.offen < 0) {
      // Ein Paar, das er kennt? Sonst eine neue Karte.
      const nachTier = new Map();
      for (const [k, t] of weiss) nachTier.set(t, [...(nachTier.get(t) || []), k]);
      const paar = [...nachTier.values()].find((ks) => ks.length >= 2);
      zug = paar ? paar[0] : raten();
    } else {
      // Die zweite Karte: das Gegenstück, wenn er es weiss.
      const tier = l.karten[l.offen];
      const gegenstueck = [...weiss].find(([k, t]) => t === tier && k !== l.offen);
      zug = gegenstueck ? gegenstueck[0] : raten();
    }
    // Nach einem Fehlversuch des anderen: erst schauen lassen.
    const warte = l.offen < 0 && l.letzter && !l.letzter.paar ? 1400 : 700;
    return { zug: String(zug), warte };
  }

  // --- Was über den Karten steht ----------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran) return null;
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    if (l.offen >= 0) return { text: l.dran === ich ? "Und die zweite Karte?" : `${er(l.dran)} sucht die zweite Karte …`, sitz: l.dran };
    const z = l.letzter;
    if (z?.paar) {
      const tier = NAMEN[l.karten[z.a]];
      return { text: z.sitz === ich ? `${tier}-Paar! Du darfst nochmal.` : `${tier}-Paar für ${er(z.sitz) === "Der Computer" ? "den Computer" : er(z.sitz)}! ${er(z.sitz)} darf nochmal.`, sitz: z.sitz };
    }
    if (z && !z.paar) return { text: l.dran === ich ? "Kein Paar – jetzt du." : `Kein Paar – ${er(l.dran) === "Du" ? "du bist" : `${er(l.dran)} ist`} dran.`, sitz: l.dran };
    return null;
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-pa-held");
    [["🐶", true], ["", false], ["🐶", true], ["🦊", false], ["", false], ["🐸", false]].forEach(([tier, paar], i) => {
      const k = el("span", `zw-pa-held-karte${tier ? " ist-offen" : ""}${paar ? " ist-paar" : ""}`, tier);
      k.style.setProperty("--i", String(i));
      bild.append(k);
    });
    return bild;
  }

  function brett({ zug, ton, ruhig }) {
    const knoten = el("div", "zw-pa");
    const stand = el("div", "zw-pa-stand");
    const zahl = { a: el("span", "zw-pa-zahl ist-a"), b: el("span", "zw-pa-zahl ist-b") };
    stand.append(zahl.a, el("span", "zw-pa-stand-mitte", "Paare"), zahl.b);
    const feld = el("div", "zw-pa-feld");
    feld.setAttribute("role", "group");
    feld.setAttribute("aria-label", "Die Karten");
    const karten = [];
    for (let k = 0; k < KARTEN; k += 1) {
      const b = el("button", "zw-pa-karte");
      b.type = "button";
      b.dataset.karte = String(k);
      const innen = el("span", "zw-pa-innen");
      const rueck = el("span", "zw-pa-rueck");
      const vorn = el("span", "zw-pa-vorn");
      innen.append(rueck, vorn);
      b.append(innen);
      b.addEventListener("click", () => tippe(k));
      karten.push({ b, vorn });
      feld.append(b);
    }
    knoten.append(stand, feld);

    let jetzt = null;
    let gezeigt = null;
    let gesperrtBis = 0;
    let gesendet = -1;
    let uhr = 0;

    const meinZug = () => Boolean(jetzt && !jetzt.aus && jetzt.ich && jetzt.dran === jetzt.ich);

    function tippe(k) {
      if (!meinZug() || Date.now() < gesperrtBis || gesendet >= 0) return;
      const l = jetzt.lage;
      if (l.besitz[k] || k === l.offen) return;
      gesendet = k;
      // Gleich umdrehen – die Antwort der Datenbank kommt hinterher.
      karten[k].b.classList.add("ist-offen");
      karten[k].vorn.textContent = TIERE[l.karten[k]];
      ton("tipp");
      zug(String(k));
    }

    function zeichne(b) {
      jetzt = b;
      const l = b.lage;
      const neuePartie = !gezeigt || gezeigt.nr !== b.nr || !b.roh.startsWith(gezeigt.roh);
      const dazu = neuePartie || b._wieder ? 0 : b.zuege.length - gezeigt.zahl;
      gesendet = -1;
      // Nach einem Fehlversuch bleiben die beiden Karten offen, bis jemand
      // die nächste aufdeckt – und einen Moment lang darf niemand tippen.
      const fehl = l.offen < 0 && l.letzter && !l.letzter.paar ? [l.letzter.a, l.letzter.b] : [];
      if (dazu > 0 && fehl.length) {
        gesperrtBis = Date.now() + (ruhig() ? 400 : 1200);
        // Danach wieder frei: noch einmal zeichnen.
        window.clearTimeout(uhr);
        uhr = window.setTimeout(() => { if (jetzt) zeichne({ ...jetzt, _wieder: true }); }, gesperrtBis - Date.now() + 20);
      }
      if (neuePartie) gesperrtBis = 0;
      const gesperrt = Date.now() < gesperrtBis;
      for (let k = 0; k < KARTEN; k += 1) {
        const { b: knopf, vorn } = karten[k];
        const wem = l.besitz[k];
        const offen = Boolean(wem) || k === l.offen || fehl.includes(k);
        knopf.className = `zw-pa-karte${offen ? " ist-offen" : ""}${wem ? ` ist-paar ist-${wem}` : ""}${fehl.includes(k) ? " ist-fehl" : ""}${l.letzter?.paar && (l.letzter.a === k || l.letzter.b === k) && dazu > 0 ? " ist-neu" : ""}`;
        vorn.textContent = offen ? TIERE[l.karten[k]] : "";
        knopf.disabled = !meinZug() || gesperrt || Boolean(wem) || k === l.offen;
        knopf.setAttribute("aria-label", `Karte ${k + 1}${offen ? `, ${NAMEN[l.karten[k]]}` : ", verdeckt"}${wem ? ", gefunden" : ""}`);
      }
      zahl.a.textContent = `${b.namen?.a || "a"}: ${l.punkte.a}`;
      zahl.b.textContent = `${b.namen?.b || "b"}: ${l.punkte.b}`;
      if (dazu > 0 && l.letzter && l.offen < 0 && b.zuege.length % 2 === 0) ton(l.letzter.paar ? "treffer" : "platsch");
      knoten.classList.toggle("ist-dran", meinZug());
      gezeigt = { nr: b.nr, roh: b.roh, zahl: b.zuege.length };
    }

    return {
      knoten,
      zeichne,
      fokus: () => karten.find(({ b }) => !b.disabled)?.b.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "paare",
    titel: "Paare finden",
    seite: "paare",
    unter: "Deck zwei Karten auf. Zwei gleiche Tiere? Dann gehören sie dir, und du darfst nochmal. Wer am Ende mehr Paare hat, gewinnt.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Vergisst fast alles" },
      einfach: { name: "Einfach", sterne: 1, satz: "Merkt sich manches" },
      mittel: { name: "Mittel", sterne: 2, satz: "Merkt sich viel" },
      schwer: { name: "Schwer", sterne: 3, satz: "Vergisst nichts" },
    },
    texte: { start: "deck eine Karte auf", remis: "Unentschieden – gleich viele Paare." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie: () => ({ saat: Math.floor(Math.random() * 4294967295) }),
  });
})();
