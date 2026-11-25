/*
 * echo.js – Echo-Duett: zusammen eine Melodie bauen, Ton für Ton.
 * ---------------------------------------------------------------------------
 * Die Seite /echo. Ein Spiel miteinander. Vier Klangfelder – rot, gelb,
 * grün, blau, jedes mit seinem Ton und seinem Zeichen. Abwechselnd spielt
 * jede die ganze Melodie bisher nach und hängt einen neuen Ton an. Wer dran
 * ist, hört die Melodie zuerst (und kann sie nochmal anhören). Ein falscher
 * Ton kostet ein Herz, und man beginnt die Melodie von vorn. Erreicht die
 * Melodie ihre Länge (so viele Töne, wie die Stufe sagt), ist es geschafft;
 * sind die drei Herzen weg, nicht.
 *
 * Ein Zug ist ein Ton: «T2» (Feld 2), getrennt durch Punkte. Die Melodie,
 * wer dran ist und wo man gerade steht, rechnet lage aus den Tönen.
 *
 * Gegen den Computer: Er ist ein verlässlicher Partner, spielt die Melodie
 * fehlerfrei nach und hängt einen Ton an. Die Stufe sagt, wie lang die
 * Melodie werden soll; zu zweit wird sie mit jeder zweiten Partie länger.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "echo") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const HERZEN = 3;
  const FELDER = [
    { name: "Rot", zeichen: "★", ton: 261.63, klasse: "ist-rot" },
    { name: "Gelb", zeichen: "●", ton: 329.63, klasse: "ist-gelb" },
    { name: "Grün", zeichen: "▲", ton: 392.0, klasse: "ist-gruen" },
    { name: "Blau", zeichen: "■", ton: 523.25, klasse: "ist-blau" },
  ];
  const ZIELE = { leicht: 5, einfach: 7, mittel: 9, schwer: 12 };

  // Wie lang die Melodie werden soll: gegen den Computer aus der Stufe, zu
  // zweit aus der Saat (die oberen Bits, neuePartie legt sie hinein).
  const zielVon = (saat, stufe) => (stufe && ZIELE[stufe] ? ZIELE[stufe] : 5 + ((Number(saat) >>> 28) & 7));

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt, saat, stufe }) {
    const ziel = zielVon(saat, stufe);
    const melodie = [];
    let dran = beginnt;
    let pos = 0;
    let herzen = HERZEN;
    let ende = null;
    let letzter = null;
    let falsch = 0;
    for (const z of zuege) {
      const m = /^T([0-3])$/.exec(z);
      if (!m || ende) return { ziel, melodie, dran: null, pos, herzen, ende, letzter, kaputt: true, falsch, zahl: zuege.length };
      const k = Number(m[1]);
      if (pos < melodie.length) {
        if (k === melodie[pos]) { pos += 1; letzter = { wer: dran, k, art: "richtig" }; } else {
          letzter = { wer: dran, k, art: "falsch", sollte: melodie[pos] };
          herzen -= 1;
          falsch += 1;
          pos = 0;
          if (herzen <= 0) ende = "v";
        }
      } else {
        melodie.push(k);
        letzter = { wer: dran, k, art: "neu" };
        pos = 0;
        if (melodie.length >= ziel) ende = "g";
        else dran = anderer(dran);
      }
    }
    return {
      ziel,
      melodie,
      dran: ende ? null : dran,
      pos,
      herzen,
      ende,
      letzter,
      falsch,
      phase: pos < melodie.length ? "nachspielen" : "neu",
      zahl: zuege.length,
    };
  }

  const darf = (l, z, sitz) => Boolean(l.dran === sitz && !l.ende && /^T[0-3]$/.test(z));

  // --- Der Computer -------------------------------------------------------------
  function computer(l, sitz) {
    if (l.ende || l.dran !== sitz) return null;
    // Am Anfang seines Zugs hört er sich die Melodie an (so lange, wie sie
    // dauert), dann tippt er Ton für Ton.
    const anfang = l.pos === 0 && l.letzter?.wer !== sitz;
    const warte = anfang ? 900 + l.melodie.length * 560 : l.letzter?.art === "falsch" ? 1400 : 430 + Math.random() * 120;
    if (l.pos < l.melodie.length) return { zug: `T${l.melodie[l.pos]}`, warte };
    // Ein neuer Ton: nicht dreimal derselbe hintereinander.
    const n = l.melodie.length;
    let k = Math.floor(Math.random() * 4);
    if (n >= 2 && l.melodie[n - 1] === k && l.melodie[n - 2] === k) k = (k + 1 + Math.floor(Math.random() * 3)) % 4;
    return { zug: `T${k}`, warte: warte + 250 };
  }

  // --- Was über den Feldern steht -------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran) return null;
    const wer = (sitz) => (modus === "computer" && sitz === "b" ? "der Computer" : name(sitz));
    const Wer = (sitz) => { const w = wer(sitz); return w.charAt(0).toUpperCase() + w.slice(1); };
    const n = l.melodie.length;
    if (l.dran === ich) {
      if (!l.zahl) return { text: "Du beginnst – tippe den ersten Ton!", sitz: ich };
      if (l.letzter?.art === "falsch" && l.letzter.wer === ich) return { text: `Hoppla – ein Herz weniger. Nochmal von vorn: ${n} ${n === 1 ? "Ton" : "Töne"}.`, sitz: ich };
      if (l.phase === "neu") return { text: "Richtig! Jetzt einen neuen Ton dazu.", sitz: ich };
      return { text: `Du bist dran: Spiel die Melodie nach (${n} ${n === 1 ? "Ton" : "Töne"}) – dann einen neuen dazu.`, sitz: ich };
    }
    if (l.letzter?.art === "falsch" && l.letzter.wer === l.dran) return { text: `${Wer(l.dran)} hat sich vertan – ein Herz weniger. ${Wer(l.dran)} ist nochmal dran.`, sitz: l.dran };
    // Sonst das Übliche: «Lena ist dran» oder «Der Computer überlegt».
    return null;
  }

  // --- Klang ----------------------------------------------------------------------
  function klang(k, dauer = 0.38) {
    const kids = window.LernappKids;
    const ctx = kids?.audioKontext?.();
    const aus = kids?.ausgang?.();
    if (!ctx || !aus) return;
    try {
      const t0 = ctx.currentTime + 0.01;
      const osz = ctx.createOscillator();
      const pegel = ctx.createGain();
      osz.type = "triangle";
      osz.frequency.setValueAtTime(FELDER[k].ton, t0);
      pegel.gain.setValueAtTime(0.0001, t0);
      pegel.gain.exponentialRampToValueAtTime(0.25, t0 + 0.015);
      pegel.gain.exponentialRampToValueAtTime(0.0001, t0 + dauer);
      osz.connect(pegel);
      pegel.connect(aus);
      osz.start(t0);
      osz.stop(t0 + dauer + 0.02);
    } catch { /* ohne Ton */ }
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-ec-held");
    FELDER.forEach((f, k) => bild.append(el("span", `zw-ec-held-feld ${f.klasse}${k === 2 ? " ist-an" : ""}`, f.zeichen)));
    bild.append(el("span", "zw-ec-held-note", "♪"));
    return bild;
  }

  function brett({ zug, ruhig, knopf }) {
    const knoten = el("div", "vr-feld zw-ec");
    knoten.dataset.zuege = "0";
    const kopf = el("div", "zw-ec-kopf");
    const herzen = el("span", "zw-ec-herzen");
    const laenge = el("div", "zw-ec-laenge");
    kopf.append(laenge, herzen);
    const flaeche = el("div", "zw-ec-felder");
    flaeche.setAttribute("role", "group");
    flaeche.setAttribute("aria-label", "Die vier Klangfelder");
    const felder = FELDER.map((f, k) => {
      const b = el("button", `zw-ec-feld ${f.klasse}`);
      b.type = "button";
      b.dataset.feld = String(k);
      b.append(el("span", "zw-ec-zeichen", f.zeichen));
      b.setAttribute("aria-label", f.name);
      b.addEventListener("pointerdown", () => { if (!b.disabled) aufleuchten(k, 0.28); });
      b.addEventListener("click", () => zug(`T${k}`));
      flaeche.append(b);
      return b;
    });
    const anhoeren = knopf("\u{1F442} Nochmal anhören", "zw-ec-anhoeren mini-knopf", () => vorspielen());
    knoten.append(kopf, flaeche, anhoeren);

    let letzte = null;
    let spielt = false;
    let marke = 0;
    let gezeigt = { nr: -1, zahl: -1, gehoert: "" };

    function aufleuchten(k, dauer = 0.38) {
      const b = felder[k];
      b.classList.remove("ist-an");
      void b.offsetWidth;
      b.classList.add("ist-an");
      window.setTimeout(() => b.classList.remove("ist-an"), dauer * 1000);
      klang(k, dauer);
    }

    const pause = (ms) => new Promise((weiter) => { window.setTimeout(weiter, ms); });
    async function vorspielen() {
      if (!letzte || spielt) return;
      const melodie = [...letzte.lage.melodie];
      if (!melodie.length) return;
      const meine = ++marke;
      spielt = true;
      bedienen();
      await pause(350);
      for (const k of melodie) {
        if (meine !== marke) return;
        aufleuchten(k, 0.38);
        await pause(ruhig() ? 300 : 560);
      }
      if (meine !== marke) return;
      spielt = false;
      bedienen();
    }

    function bedienen() {
      if (!letzte) return;
      const { lage: l, ich, aus } = letzte;
      const meinZug = Boolean(!aus && ich && l.dran === ich && !l.ende && !spielt);
      felder.forEach((b) => { b.disabled = !meinZug; });
      anhoeren.disabled = spielt || !l.melodie.length || l.ende;
      anhoeren.hidden = Boolean(l.ende);
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-spielt", spielt);
    }

    function zeichne(args) {
      const { lage: l, nr, ich } = args;
      const neu = nr === gezeigt.nr && l.zahl === gezeigt.zahl + 1;
      if (nr !== gezeigt.nr) { marke += 1; spielt = false; }
      letzte = args;
      // Was jemand anderes getippt hat, leuchtet und klingt hier auch.
      if (neu && l.letzter && l.letzter.wer !== ich) aufleuchten(l.letzter.k, 0.3);
      if (neu && l.letzter?.art === "falsch") {
        knoten.classList.remove("ist-falsch");
        void knoten.offsetWidth;
        knoten.classList.add("ist-falsch");
        Z.ton?.("platsch");
      }
      laenge.innerHTML = "";
      laenge.append(el("span", "zw-ec-lang", `Melodie: ${l.melodie.length} von ${l.ziel} Tönen`), el("span", "zw-ec-kurz", `\u266A ${l.melodie.length} / ${l.ziel}`));
      laenge.setAttribute("aria-label", `Melodie: ${l.melodie.length} von ${l.ziel} Tönen`);
      herzen.textContent = "❤️".repeat(Math.max(0, l.herzen)) + "\u{1F90D}".repeat(Math.max(0, HERZEN - l.herzen));
      herzen.setAttribute("aria-label", `${l.herzen} von ${HERZEN} Herzen`);
      // Fortschritt: so viele Punkte wie Töne bis zum Ziel.
      knoten.style.setProperty("--fortschritt", String(l.melodie.length / l.ziel));
      gezeigt = { nr, zahl: l.zahl, gehoert: gezeigt.gehoert };
      knoten.dataset.zuege = String(l.zahl);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.classList.toggle("ist-geschafft", l.ende === "g");
      bedienen();
      // Bin ich neu dran (die Melodie ist gewachsen, oder ich muss von vorn),
      // spielt das Gerät sie mir einmal vor.
      const schluessel = `${nr}|${l.melodie.length}|${l.falsch}`;
      if (ich && l.dran === ich && !l.ende && l.pos === 0 && l.melodie.length && gezeigt.gehoert !== schluessel) {
        gezeigt.gehoert = schluessel;
        window.setTimeout(() => vorspielen(), l.letzter?.wer === ich ? 900 : 500);
      }
    }

    return {
      knoten,
      zeichne,
      fokus: () => (felder.find((b) => !b.disabled) || felder[0]).focus({ preventScroll: true }),
    };
  }

  // Zu zweit wird die Melodie mit jeder zweiten Partie länger.
  function neuePartie(stufe, { nr = 0 } = {}) {
    const mehr = stufe ? 0 : Math.min(7, 1 + Math.floor((Number(nr) || 0) / 2));
    return { saat: ((mehr << 28) | Math.floor(Math.random() * 0x0fffffff)) >>> 0 };
  }

  Z.starte({
    id: "echo",
    titel: "Echo-Duett",
    seite: "echo",
    unter: "Zusammen! Spielt abwechselnd die Melodie nach und hängt einen neuen Ton an. Ein falscher Ton kostet ein Herz. Wie lang wird eure Melodie?",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Fünf Töne" },
      einfach: { name: "Einfach", sterne: 1, satz: "Sieben Töne" },
      mittel: { name: "Mittel", sterne: 2, satz: "Neun Töne" },
      schwer: { name: "Schwer", sterne: 3, satz: "Zwölf Töne" },
    },
    texte: { start: "tippe den ersten Ton", geschafft: "Geschafft – was für eine Melodie!", verpasst: "Die Herzen sind weg – nicht geschafft." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie,
    vorlesen: (b) => (b.lage.ende ? "" : `Die Melodie hat ${b.lage.melodie.length} von ${b.lage.ziel} Tönen. Noch ${b.lage.herzen} Herzen.`),
    fuerPruefung: { FELDER, ZIELE, HERZEN, zielVon },
  });
})();
