/*
 * ratetier.js – Rate-Tier: Wer errät zuerst das Tier der anderen?
 * ---------------------------------------------------------------------------
 * Die Seite /ratetier. Jede bekommt geheim eines von 16 Tieren (aus der Saat
 * der Partie, verschieden). Abwechselnd fragt man etwas über das Tier der
 * anderen – «Kann es fliegen?», «Hat es Fell?» … (Bild und Wort, acht
 * Fragen) – oder rät ein Tier. Die Antwort kommt sofort, und die Tiere, die
 * nicht mehr passen, werden blass: Man sieht, was noch möglich ist. Wer das
 * Tier der anderen zuerst errät, gewinnt. Falsch geraten heisst nur: Dieses
 * Tier war es nicht, und die andere ist dran.
 *
 * Die 16 Tiere unterscheiden sich in den acht Fragen alle (pruefen.mjs
 * prüft das), und die Antworten sind die, die ein Kind erwartet: Der
 * Pinguin kann nicht fliegen, die Biene hat kein Fell, der Frosch lebt im
 * Wasser.
 *
 * Ein Zug ist «F3» (Frage 3) oder «T7» (Tier 7 geraten), getrennt durch
 * Punkte. Gerechnet wird alles aus Saat und Zügen: Jedes Gerät kennt beide
 * Tiere, zeigt aber nur das eigene.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen nur das Brett, die Regeln und der Computer.
 *
 * Der Computer:
 *
 *   leicht    fragt irgendetwas, rät manchmal einfach so
 *   einfach   fragt meist etwas, das weiterhilft
 *   mittel    fragt, was die Tiere am besten in zwei Hälften teilt
 *   schwer    ebenso – und rät bei zweien gleich
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "ratetier") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  // Die Fragen: Bild, kurzes Wort auf dem Knopf, die ganze Frage.
  const FRAGEN = [
    { bild: "✈️", kurz: "Fliegen?", frage: "Kann es fliegen?" },
    { bild: "\u{1F43E}", kurz: "Vier Beine?", frage: "Hat es vier Beine?" },
    { bild: "\u{1F9F8}", kurz: "Fell?", frage: "Hat es Fell?" },
    { bild: "\u{1F30A}", kurz: "Im Wasser?", frage: "Lebt es im Wasser?" },
    { bild: "\u{1F4CF}", kurz: "Grösser als du?", frage: "Ist es grösser als du?" },
    { bild: "", streifen: true, kurz: "Streifen?", frage: "Hat es Streifen?" },
    { bild: "\u{1F95A}", kurz: "Eier?", frage: "Legt es Eier?" },
    { bild: "\u{1F356}", kurz: "Frisst Tiere?", frage: "Frisst es andere Tiere?" },
  ];

  // Die Tiere und ihre Antworten, in der Reihenfolge der Fragen:
  // fliegen, vier Beine, Fell, Wasser, grösser als du, Streifen, Eier,
  // frisst Tiere.
  const TIERE = [
    { bild: "\u{1F436}", wort: "Hund", art: "der", ant: "01100001" },
    { bild: "\u{1F430}", wort: "Hase", art: "der", ant: "01100000" },
    { bild: "\u{1F42E}", wort: "Kuh", art: "die", ant: "01101000" },
    { bild: "\u{1F42F}", wort: "Tiger", art: "der", ant: "01101101" },
    { bild: "\u{1F981}", wort: "Löwe", art: "der", ant: "01101001" },
    { bild: "\u{1F993}", wort: "Zebra", art: "das", ant: "01101100" },
    { bild: "\u{1F418}", wort: "Elefant", art: "der", ant: "01001000" },
    { bild: "\u{1F438}", wort: "Frosch", art: "der", ant: "01010011" },
    { bild: "\u{1F42C}", wort: "Delfin", art: "der", ant: "00011001" },
    { bild: "\u{1F420}", wort: "Fisch", art: "der", ant: "00010110" },
    { bild: "\u{1F427}", wort: "Pinguin", art: "der", ant: "00010011" },
    { bild: "\u{1F989}", wort: "Eule", art: "die", ant: "10000011" },
    { bild: "\u{1F99C}", wort: "Papagei", art: "der", ant: "10000010" },
    { bild: "\u{1F41D}", wort: "Biene", art: "die", ant: "10000110" },
    { bild: "\u{1F40D}", wort: "Schlange", art: "die", ant: "00000011" },
    { bild: "\u{1F40A}", wort: "Krokodil", art: "das", ant: "01011011" },
  ];
  const passt = (t, q) => TIERE[t].ant[q] === "1";

  // Der Würfel aus der Saat (wie in den anderen Spielen): Jedes Gerät zieht
  // dieselben zwei Tiere.
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
  function geheimeTiere(saat) {
    const rnd = wuerfel((Number(saat) ^ 0x7ae15) >>> 0);
    const a = Math.floor(rnd() * TIERE.length);
    let b = Math.floor(rnd() * (TIERE.length - 1));
    if (b >= a) b += 1;
    return { a, b };
  }

  // Welche Tiere nach den Antworten und falschen Tipps noch möglich sind.
  function kandidaten(fragen, falsch) {
    return TIERE.map((_, t) => t).filter((t) => !falsch.includes(t) && fragen.every(({ q, ja }) => passt(t, q) === ja));
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt, saat }) {
    const geheim = geheimeTiere(saat);
    const fragen = { a: [], b: [] };
    const falsch = { a: [], b: [] };
    let dran = beginnt;
    let ende = null;
    let letzter = null;
    let kaputt = false;
    for (const z of zuege) {
      const m = /^([FT])(0|[1-9]\d?)$/.exec(z);
      const n = m ? Number(m[2]) : -1;
      const gegner = anderer(dran);
      if (ende || !m || (m[1] === "F" && (n >= FRAGEN.length || fragen[dran].some((f) => f.q === n)))
        || (m[1] === "T" && (n >= TIERE.length || falsch[dran].includes(n)))) { kaputt = true; break; }
      if (m[1] === "F") {
        const ja = passt(geheim[gegner], n);
        fragen[dran].push({ q: n, ja });
        letzter = { sitz: dran, art: "F", q: n, ja };
        dran = gegner;
      } else if (n === geheim[gegner]) {
        letzter = { sitz: dran, art: "T", tier: n, richtig: true };
        ende = dran;
      } else {
        falsch[dran].push(n);
        letzter = { sitz: dran, art: "T", tier: n, richtig: false };
        dran = gegner;
      }
    }
    const moeglich = { a: kandidaten(fragen.a, falsch.a), b: kandidaten(fragen.b, falsch.b) };
    return { geheim, fragen, falsch, moeglich, dran: ende || kaputt ? null : dran, ende, letzter, kaputt, zahl: zuege.length };
  }

  // Fragen darf man jede einmal; raten nur ein Tier, das noch möglich ist.
  function darf(l, z, sitz) {
    if (l.dran !== sitz || l.ende) return false;
    const m = /^([FT])(0|[1-9]\d?)$/.exec(z);
    if (!m) return false;
    const n = Number(m[2]);
    if (m[1] === "F") return n < FRAGEN.length && !l.fragen[sitz].some((f) => f.q === n);
    return l.moeglich[sitz].includes(n);
  }

  // --- Der Computer -------------------------------------------------------------
  const zufall = (liste) => liste[Math.floor(Math.random() * liste.length)];

  function computer(l, sitz, stufe) {
    const kand = l.moeglich[sitz];
    if (!kand.length) return null;
    const offen = FRAGEN.map((_, q) => q).filter((q) => !l.fragen[sitz].some((f) => f.q === q));
    const teilt = (q) => { const ja = kand.filter((t) => passt(t, q)).length; return Math.min(ja, kand.length - ja); };
    const nuetzlich = offen.filter((q) => teilt(q) > 0);
    const beste = () => { const m = Math.max(...nuetzlich.map(teilt)); return nuetzlich.filter((q) => teilt(q) === m); };
    let zug;
    if (kand.length === 1 || !nuetzlich.length) zug = `T${zufall(kand)}`;
    else if (stufe === "leicht") zug = Math.random() < 0.2 || !offen.length ? `T${zufall(kand)}` : `F${zufall(offen)}`;
    else if (stufe === "einfach") zug = kand.length <= 2 && Math.random() < 0.6 ? `T${zufall(kand)}` : `F${zufall(Math.random() < 0.3 ? offen : nuetzlich)}`;
    else if (stufe === "mittel") zug = kand.length === 2 && Math.random() < 0.5 ? `T${zufall(kand)}` : `F${zufall(beste())}`;
    else zug = kand.length === 2 ? `T${zufall(kand)}` : `F${zufall(beste())}`;
    // Erst wenn man die Antwort auf die eigene Frage lesen konnte.
    return { zug, warte: 1700 + Math.random() * 500 };
  }

  // --- Was über dem Brett steht ---------------------------------------------------
  const mitArt = (t) => `${TIERE[t].art} ${TIERE[t].wort}`;
  const Gross = (text) => text.charAt(0).toUpperCase() + text.slice(1);

  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran) return null;
    const wer = (sitz) => (modus === "computer" && sitz === "b" ? "der Computer" : name(sitz));
    const jetzt = l.dran === ich ? "Du bist dran." : `${Gross(wer(l.dran))} ist dran.`;
    const z = l.letzter;
    if (!z) {
      if (l.dran === ich) return { text: `Du beginnst – frag etwas über das Tier ${modus === "computer" ? "des Computers" : `von ${wer(anderer(ich))}`}!`, sitz: ich };
      return null;
    }
    if (z.art === "F") {
      const frage = FRAGEN[z.q].frage;
      const antwort = z.ja ? "Ja!" : "Nein!";
      if (z.sitz === ich) return { text: `«${frage}» – ${antwort} ${jetzt}`, sitz: l.dran };
      return { text: `${Gross(wer(z.sitz))} fragt: «${frage}» – ${z.ja ? "Ja" : "Nein"}. ${jetzt}`, sitz: l.dran };
    }
    if (z.sitz === ich) return { text: `Nicht ${TIERE[z.tier].art === "die" ? "die" : TIERE[z.tier].art === "das" ? "das" : "der"} ${TIERE[z.tier].wort}! ${jetzt}`, sitz: l.dran };
    return { text: `${Gross(wer(z.sitz))} rät ${TIERE[z.tier].art === "der" ? "den" : TIERE[z.tier].art} ${TIERE[z.tier].wort} – falsch! ${jetzt}`, sitz: l.dran };
  }

  // --- Das Bild -------------------------------------------------------------------
  function fragBild(q) {
    const f = FRAGEN[q];
    const b = el("span", `zw-rt-frage-bild${f.streifen ? " ist-streifen" : ""}`, f.bild);
    b.setAttribute("aria-hidden", "true");
    return b;
  }

  function held() {
    const bild = el("div", "zw-rt-held");
    [0, 4, 10, 13, 5, 11].forEach((t, i) => {
      const k = el("span", `zw-rt-held-karte${i === 3 || i === 4 ? " ist-weg" : ""}`, TIERE[t].bild);
      bild.append(k);
    });
    bild.append(el("span", "zw-rt-held-frage", "?"));
    return bild;
  }

  function brett({ zug, ton, knopf }) {
    const knoten = el("div", "vr-feld zw-rt");
    knoten.dataset.zuege = "0";

    // Oben: das eigene Tier (geheim) und wie weit die andere ist.
    const kopf = el("div", "zw-rt-kopf");
    const meins = el("div", "zw-rt-meins");
    const meinBild = el("span", "zw-rt-meins-bild");
    meinBild.setAttribute("aria-hidden", "true");
    const meinText = el("span", "zw-rt-meins-text");
    const meinTitel = el("span", "zw-rt-meins-titel", "Dein Tier");
    const meinWort = el("strong", "zw-rt-meins-wort");
    meinText.append(meinTitel, meinWort);
    const gefragt = el("span", "zw-rt-gefragt");
    meins.append(meinBild, meinText, gefragt);
    const andere = el("div", "zw-rt-andere");
    kopf.append(meins, andere);

    const titel = el("div", "zw-rt-titel");
    const tiere = el("div", "zw-rt-tiere");
    tiere.setAttribute("role", "group");
    const karten = TIERE.map((t, i) => {
      const k = el("button", "zw-rt-karte");
      k.type = "button";
      k.dataset.tier = String(i);
      k.append(el("span", "zw-rt-karte-bild", t.bild), el("span", "zw-rt-karte-wort", t.wort));
      k.addEventListener("click", () => waehlen(i));
      tiere.append(k);
      return k;
    });

    const fragen = el("div", "zw-rt-fragen");
    fragen.setAttribute("role", "group");
    fragen.setAttribute("aria-label", "Die Fragen");
    const raten = knopf("", "zw-rt-raten mini-knopf mini-knopf-voll", () => {
      if (auswahl === null) return;
      const t = auswahl;
      auswahl = null;
      zug(`T${t}`);
    });
    raten.hidden = true;
    // Wer ein Tier angetippt hat, sieht statt der Fragen «Raten!» – und
    // kann es sich noch anders überlegen.
    const dochNicht = knopf("Doch lieber fragen", "zw-rt-doch mini-knopf", () => { auswahl = null; aktualisieren(); });
    dochNicht.hidden = true;
    const fragKnoepfe = FRAGEN.map((f, q) => {
      const k = el("button", "zw-rt-frage");
      k.type = "button";
      k.dataset.frage = String(q);
      const antwort = el("span", "zw-rt-antwort");
      k.append(fragBild(q), el("span", "zw-rt-frage-wort", f.kurz), antwort);
      k.addEventListener("click", () => { auswahl = null; zug(`F${q}`); });
      fragen.append(k);
      return { k, antwort };
    });
    const rechts = el("div", "zw-rt-rechts");
    rechts.append(raten, dochNicht, fragen);
    knoten.append(kopf, titel, tiere, rechts);

    let auswahl = null;
    let letzte = null;
    let gezeigt = { nr: -1, zahl: -1 };

    function waehlen(t) {
      if (!letzte) return;
      const { lage: l, ich, aus } = letzte;
      if (aus || !ich || l.dran !== ich || l.ende || !l.moeglich[ich].includes(t)) return;
      auswahl = auswahl === t ? null : t;
      ton("tipp");
      aktualisieren();
    }

    function aktualisieren() {
      if (!letzte) return;
      const { lage: l, ich, aus, namen, modus } = letzte;
      const sicht = ich || "a";
      const gegner = anderer(sicht);
      const meinZug = Boolean(!aus && ich && l.dran === ich && !l.ende);
      const name = (s) => (modus === "computer" && s === "b" ? "Computer" : namen?.[s] || s);
      // Das eigene Tier – geheim, nur hier zu sehen.
      const mein = TIERE[l.geheim[sicht]];
      meinBild.textContent = mein.bild;
      meinWort.textContent = mein.wort;
      meins.setAttribute("aria-label", `Dein geheimes Tier: ${mein.wort}`);
      // Was die andere über das eigene Tier schon gefragt hat.
      gefragt.innerHTML = "";
      l.fragen[gegner].forEach(({ q, ja }) => {
        const chip = el("span", `zw-rt-chip ${ja ? "ist-ja" : "ist-nein"}`);
        chip.append(fragBild(q), el("span", "zw-rt-chip-wort", ja ? "Ja" : "Nein"));
        chip.title = `${name(gegner)} fragte: ${FRAGEN[q].frage} – ${ja ? "Ja" : "Nein"}`;
        gefragt.append(chip);
      });
      const n = l.moeglich[gegner].length;
      andere.textContent = `${name(gegner)}: noch ${n} ${n === 1 ? "Tier" : "Tiere"}`;
      andere.classList.toggle("ist-knapp", n <= 2);
      titel.textContent = l.ende
        ? `${name(gegner)} hatte ${mitArt(l.geheim[gegner])}`
        : `Welches Tier hat ${modus === "computer" ? "der Computer" : name(gegner)}?`;
      tiere.setAttribute("aria-label", titel.textContent);

      const moeglich = new Set(l.moeglich[sicht]);
      if (auswahl !== null && (!meinZug || !moeglich.has(auswahl))) auswahl = null;
      karten.forEach((k, t) => {
        const weg = !moeglich.has(t);
        const richtig = Boolean(l.ende && t === l.geheim[gegner]);
        k.classList.toggle("ist-weg", weg && !richtig);
        k.classList.toggle("ist-falsch", l.falsch[sicht].includes(t));
        k.classList.toggle("ist-gewaehlt", t === auswahl);
        k.classList.toggle("ist-richtig", richtig);
        k.classList.toggle("ist-sieger", richtig && l.ende === sicht);
        k.disabled = !meinZug || weg;
        k.setAttribute("aria-label", `${TIERE[t].wort}${weg ? ", passt nicht" : ""}${richtig ? ", das ist es" : ""}`);
      });
      fragKnoepfe.forEach(({ k, antwort }, q) => {
        const gefragtVonMir = l.fragen[sicht].find((f) => f.q === q);
        k.classList.toggle("ist-gefragt", Boolean(gefragtVonMir));
        k.classList.toggle("ist-ja", Boolean(gefragtVonMir?.ja));
        k.classList.toggle("ist-nein", Boolean(gefragtVonMir && !gefragtVonMir.ja));
        antwort.textContent = gefragtVonMir ? (gefragtVonMir.ja ? "Ja" : "Nein") : "";
        k.disabled = !meinZug || Boolean(gefragtVonMir);
        k.setAttribute("aria-label", `${FRAGEN[q].frage}${gefragtVonMir ? ` – ${gefragtVonMir.ja ? "Ja" : "Nein"}` : ""}`);
      });
      // Raten: erst ein Tier antippen, dann hier bestätigen. Bleibt nur
      // eines, steht der Knopf gleich da.
      if (meinZug && auswahl === null && moeglich.size === 1) auswahl = [...moeglich][0];
      raten.hidden = !(meinZug && auswahl !== null);
      // Bleibt nur ein Tier, gibt es nichts mehr zu fragen.
      dochNicht.hidden = raten.hidden || moeglich.size === 1;
      knoten.classList.toggle("ist-raten", !raten.hidden);
      if (!raten.hidden) {
        raten.textContent = `${TIERE[auswahl].bild} Ist es ${mitArt(auswahl)}? Raten!`;
        karten[auswahl].classList.add("ist-gewaehlt");
      }
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
    }

    function zeichne(args) {
      const { lage: l, nr } = args;
      const neu = nr === gezeigt.nr && l.zahl === gezeigt.zahl + 1;
      if (nr !== gezeigt.nr) auswahl = null;
      letzte = args;
      if (neu && l.letzter) {
        ton(l.letzter.art === "T" ? (l.letzter.richtig ? "treffer" : "platsch") : "tipp");
        // Was die Antwort gerade ausgeschlossen hat, wird kurz sichtbar blass.
        if (l.letzter.sitz === (args.ich || "a")) {
          knoten.classList.remove("ist-neu");
          void knoten.offsetWidth;
          knoten.classList.add("ist-neu");
        }
      }
      gezeigt = { nr, zahl: l.zahl };
      knoten.dataset.zuege = String(l.zahl);
      aktualisieren();
    }

    return {
      knoten,
      zeichne,
      fokus: () => (fragKnoepfe.find(({ k }) => !k.disabled)?.k || karten.find((k) => !k.disabled) || karten[0]).focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "ratetier",
    titel: "Rate-Tier",
    seite: "ratetier",
    unter: "Jede hat ein geheimes Tier. Fragt abwechselnd – «Kann es fliegen?», «Hat es Fell?» – und ratet. Wer zuerst das Tier der anderen errät, gewinnt.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Fragt geschickt" },
      schwer: { name: "Schwer", sterne: 3, satz: "Fragt immer die beste Frage" },
    },
    texte: { start: "frag etwas oder rate", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    satz,
    // Was der Lautsprecher beim Satz noch vorliest: das eigene Tier und was
    // beim anderen noch möglich ist.
    vorlesen: (b) => {
      const l = b.lage;
      const ich = b.ich || "a";
      const noch = l.moeglich[ich].map((t) => TIERE[t].wort);
      return `Dein Tier ist ${mitArt(l.geheim[ich])}. Noch möglich: ${noch.join(", ")}.`;
    },
    fuerPruefung: { FRAGEN, TIERE, geheimeTiere, kandidaten },
  });
})();
