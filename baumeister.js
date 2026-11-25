/*
 * baumeister.js – Baumeister: Eine merkt sich den Plan, die andere baut.
 * ---------------------------------------------------------------------------
 * Die Seite /baumeister. Ein Spiel miteinander, vier Runden. In jeder Runde
 * ist eine die Planerin, die andere die Baumeisterin – jede Runde wechselt
 * es.
 *
 *   1. Merken: Die Planerin sieht den Plan – ein Raster mit ein paar bunten
 *      Klötzen – und merkt ihn sich. «Gemerkt!» versteckt ihn.
 *   2. Bauen: Die Baumeisterin tippt auf ein Feld und fragt so: «Was kommt
 *      hierhin?» Die Planerin antwortet aus dem Kopf (eine Farbe oder
 *      «nichts»), die Baumeisterin hört oder liest die Antwort und setzt
 *      den Klotz selbst. Das geht Feld für Feld, in jeder Reihenfolge, auch
 *      nochmal.
 *   3. «Fertig!»: Der Plan kommt wieder zum Vorschein. Stimmt alles, ist die
 *      Runde geschafft.
 *
 * Drei von vier Runden geschafft – die Partie ist geschafft.
 *
 * Wie gross der Plan ist und wie viele Klötze er hat, sagt die Stufe (gegen
 * den Computer) oder, zu zweit, die wievielte Partie es ist: Es wird mit der
 * Zeit schwerer. Der Plan kommt aus Saat und Runde.
 *
 * Ein Zug ist «M» (gemerkt), «Q5» (Feld 5 fragen), «A2» (Antwort: Farbe 2,
 * 0 heisst nichts), «B2» (Klotz der Farbe 2 setzen, 0 heisst wegnehmen) oder
 * «X» (fertig), getrennt durch Punkte.
 *
 * Gegen den Computer: Ist er die Planerin, merkt er sich alles und
 * antwortet richtig; ist er die Baumeisterin, fragt er Feld für Feld und
 * setzt genau, was man ihm sagt.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "baumeister") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const RUNDEN = 4;
  const GESCHAFFT_AB = 3;
  const FARBEN = [
    { wort: "nichts", klasse: "ist-leer" },
    { wort: "Rot", klasse: "ist-rot" },
    { wort: "Gelb", klasse: "ist-gelb" },
    { wort: "Blau", klasse: "ist-blau" },
    { wort: "Grün", klasse: "ist-gruen" },
  ];
  // Die Grade: Rastergrösse, wie viele Farben, wie viele Klötze.
  const GRADE = [
    { n: 3, farben: 2, kloetze: 3 },
    { n: 3, farben: 3, kloetze: 4 },
    { n: 3, farben: 3, kloetze: 6 },
    { n: 4, farben: 4, kloetze: 7 },
  ];
  const STUFE_GRAD = { leicht: 0, einfach: 1, mittel: 2, schwer: 3 };

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

  // Der Grad: gegen den Computer aus der Stufe, zu zweit aus der Saat (die
  // oberen Bits, neuePartie legt ihn hinein).
  const gradVon = (saat, stufe) => (stufe && STUFE_GRAD[stufe] !== undefined ? STUFE_GRAD[stufe] : Math.min(GRADE.length - 1, (Number(saat) >>> 29) & 3));

  // Der Plan einer Runde: für jedes Feld eine Farbe (0: nichts).
  function plan(saat, runde, grad) {
    const g = GRADE[grad];
    const rnd = wuerfel(((Number(saat) >>> 0) ^ Math.imul(runde + 1, 0x9e3779b1)) >>> 0);
    const felder = Array(g.n * g.n).fill(0);
    const frei = felder.map((_, i) => i);
    for (let k = 0; k < g.kloetze; k += 1) {
      const i = frei.splice(Math.floor(rnd() * frei.length), 1)[0];
      felder[i] = 1 + Math.floor(rnd() * g.farben);
    }
    // Jede Farbe mindestens einmal, wenn Platz ist.
    for (let f = 1; f <= g.farben && g.kloetze >= g.farben; f += 1) {
      if (!felder.includes(f)) { const i = felder.findIndex((x) => x && felder.filter((y) => y === x).length > 1); if (i >= 0) felder[i] = f; }
    }
    return { n: g.n, farben: g.farben, felder };
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { beginnt, saat, stufe }) {
    const grad = gradVon(saat, stufe);
    const rollen = (r) => ({ planerin: r % 2 === 0 ? beginnt : anderer(beginnt), baumeisterin: r % 2 === 0 ? anderer(beginnt) : beginnt });
    let runde = 0;
    let p = plan(saat, 0, grad);
    let bau = Array(p.n * p.n).fill(0);
    let phase = "merken";
    let frage = -1;
    let antwort = null;
    let gefragt = [];
    const ergebnisse = [];
    let ende = null;
    let letzter = null;
    const fertigMit = () => {
      const richtig = bau.every((x, i) => x === p.felder[i]);
      ergebnisse.push({ runde, richtig, plan: p.felder, bau: [...bau], falsch: bau.filter((x, i) => x !== p.felder[i]).length });
      runde += 1;
      if (runde >= RUNDEN) {
        ende = ergebnisse.filter((e) => e.richtig).length >= GESCHAFFT_AB ? "g" : "v";
        return;
      }
      p = plan(saat, runde, grad);
      bau = Array(p.n * p.n).fill(0);
      phase = "merken";
      frage = -1;
      antwort = null;
      gefragt = [];
    };
    const dranJetzt = () => {
      const r = rollen(runde);
      if (phase === "merken") return r.planerin;
      if (phase === "antworten") return r.planerin;
      return r.baumeisterin;
    };
    for (const z of zuege) {
      const m = /^([MQABX])(\d{0,2})$/.exec(z);
      const wer = dranJetzt();
      const n = m && m[2] !== "" ? Number(m[2]) : -1;
      let ok = Boolean(m) && !ende;
      if (ok) {
        if (m[1] === "M") ok = phase === "merken" && m[2] === "";
        else if (m[1] === "Q") ok = phase === "bauen" && n >= 0 && n < bau.length && String(n) === m[2];
        else if (m[1] === "A") ok = phase === "antworten" && n >= 0 && n <= p.farben && m[2].length === 1;
        else if (m[1] === "B") ok = phase === "setzen" && n >= 0 && n <= p.farben && m[2].length === 1;
        else ok = phase === "bauen" && m[2] === "";
      }
      if (!ok) return { grad, runde, plan: p, bau, phase, frage, antwort, gefragt, ergebnisse, rollen: rollen(Math.min(runde, RUNDEN - 1)), dran: null, ende, letzter, kaputt: true, zahl: zuege.length };
      letzter = { wer, art: m[1], n };
      if (m[1] === "M") phase = "bauen";
      else if (m[1] === "Q") { frage = n; antwort = null; phase = "antworten"; if (!gefragt.includes(n)) gefragt.push(n); }
      else if (m[1] === "A") { antwort = n; phase = "setzen"; }
      else if (m[1] === "B") { bau[frage] = n; phase = "bauen"; letzter.feld = frage; }
      else fertigMit();
    }
    return {
      grad,
      runde: Math.min(runde, RUNDEN - 1),
      plan: p,
      bau,
      phase: ende ? "ende" : phase,
      frage,
      antwort,
      gefragt,
      ergebnisse,
      rollen: rollen(Math.min(runde, RUNDEN - 1)),
      dran: ende ? null : dranJetzt(),
      ende,
      letzter,
      zahl: zuege.length,
    };
  }

  function darf(l, z, sitz) {
    if (l.ende || l.dran !== sitz) return false;
    const m = /^([MQABX])(\d{0,2})$/.exec(z);
    if (!m) return false;
    const n = m[2] === "" ? -1 : Number(m[2]);
    if (m[1] === "M") return l.phase === "merken" && m[2] === "";
    if (m[1] === "Q") return l.phase === "bauen" && n >= 0 && n < l.bau.length && String(n) === m[2];
    if (m[1] === "A") return l.phase === "antworten" && n >= 0 && n <= l.plan.farben && m[2].length === 1;
    if (m[1] === "B") return l.phase === "setzen" && n >= 0 && n <= l.plan.farben && m[2].length === 1;
    return l.phase === "bauen" && m[2] === "";
  }

  // --- Der Computer -------------------------------------------------------------
  // Er ist ein verlässlicher Partner: Als Planerin merkt er sich alles, als
  // Baumeisterin fragt er der Reihe nach und setzt, was man sagt. Die Stufe
  // macht nur den Plan grösser.
  function computer(l, sitz) {
    if (l.ende || l.dran !== sitz) return null;
    const ruhe = (ms) => ms + Math.random() * 300;
    if (l.phase === "merken") return { zug: "M", warte: ruhe(1400) };
    if (l.phase === "antworten") return { zug: `A${l.plan.felder[l.frage]}`, warte: ruhe(1000) };
    if (l.phase === "setzen") return { zug: `B${l.antwort}`, warte: ruhe(700) };
    // Bauen: das nächste Feld, das noch nicht gefragt wurde – dann fertig.
    const naechstes = l.bau.findIndex((_, i) => !l.gefragt.includes(i));
    if (naechstes < 0) return { zug: "X", warte: ruhe(900) };
    return { zug: `Q${naechstes}`, warte: ruhe(800) };
  }

  // --- Was über dem Brett steht ---------------------------------------------------
  const ORT_WORT = (n, i) => {
    const r = Math.floor(i / n); const c = i % n;
    const reihe = n === 3 ? ["oben", "in der Mitte", "unten"][r] : ["ganz oben", "oben", "unten", "ganz unten"][r];
    const spalte = n === 3 ? ["links", "in der Mitte", "rechts"][c] : ["ganz links", "links", "rechts", "ganz rechts"][c];
    if (n === 3 && r === 1 && c === 1) return "genau in der Mitte";
    return `${reihe} ${spalte}`;
  };

  function satz(l, { ich, name, modus }) {
    if (l.ende) return null;
    const wer = (sitz) => (modus === "computer" && sitz === "b" ? "der Computer" : name(sitz));
    const Wer = (sitz) => { const w = wer(sitz); return w.charAt(0).toUpperCase() + w.slice(1); };
    const r = l.rollen;
    const vorher = l.ergebnisse.length && l.phase === "merken" && l.letzter?.art === "X"
      ? (l.ergebnisse[l.ergebnisse.length - 1].richtig ? "Runde geschafft! " : "Nicht ganz – ein paar Klötze waren anders. ")
      : "";
    if (l.zahl === 0) {
      // Ganz am Anfang: wer beginnt, ist die Planerin (die andere sieht «… ist dran»).
      return r.planerin === ich ? { text: "Du beginnst als Planerin: Merk dir den Plan, dann tippe «Gemerkt!».", sitz: ich } : null;
    }
    if (l.phase === "merken") {
      if (r.planerin === ich) return { text: `${vorher}Du bist die Planerin: Merk dir den Plan, dann tippe «Gemerkt!».`, sitz: ich };
      return { text: `${vorher}${Wer(r.planerin)} merkt sich den Plan – du baust gleich.`, sitz: r.planerin };
    }
    if (l.phase === "bauen") {
      if (r.baumeisterin === ich) return { text: "Tippe auf ein Feld und frag: Was kommt hierhin? Bist du fertig, tippe «Fertig!».", sitz: ich };
      return { text: `${Wer(r.baumeisterin)} baut. Warte auf die Frage.`, sitz: r.baumeisterin };
    }
    if (l.phase === "antworten") {
      const ort = ORT_WORT(l.plan.n, l.frage);
      if (r.planerin === ich) return { text: `Was kommt ${ort} hin? Tippe die Farbe – oder «nichts».`, sitz: ich };
      return { text: `Du fragst: Was kommt ${ort} hin? ${Wer(r.planerin)} überlegt …`, sitz: r.planerin };
    }
    const wort = FARBEN[l.antwort].wort;
    if (r.baumeisterin === ich) return { text: l.antwort ? `${Wer(r.planerin)} sagt: ${wort}! Setz den Klotz.` : `${Wer(r.planerin)} sagt: nichts! Tippe «nichts».`, sitz: ich };
    return { text: `Du hast gesagt: ${wort}. ${Wer(r.baumeisterin)} setzt den Klotz.`, sitz: r.baumeisterin };
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-bm-held");
    [1, 0, 3, 0, 2, 0, 4, 0, 1].forEach((f) => bild.append(el("span", `zw-bm-held-feld ${FARBEN[f].klasse}`)));
    bild.append(el("span", "zw-bm-held-blase", "?"));
    return bild;
  }

  function brett({ zug, ton, knopf }) {
    const knoten = el("div", "vr-feld zw-bm");
    knoten.dataset.zuege = "0";
    const kopf = el("div", "zw-bm-kopf");
    const runden = el("div", "zw-bm-runden");
    const rolle = el("div", "zw-bm-rolle");
    kopf.append(runden, rolle);
    const flaeche = el("div", "zw-bm-flaeche");
    const raster = el("div", "zw-bm-raster");
    raster.setAttribute("role", "group");
    const planBild = el("div", "zw-bm-raster ist-plan");
    planBild.setAttribute("aria-label", "Der Plan");
    flaeche.append(raster, planBild);
    const farbenLeiste = el("div", "zw-bm-farben");
    farbenLeiste.setAttribute("role", "group");
    farbenLeiste.setAttribute("aria-label", "Die Farben");
    const farbKnoepfe = FARBEN.map((f, k) => {
      const b = el("button", `zw-bm-farbe ${f.klasse}`);
      b.type = "button";
      b.dataset.farbe = String(k);
      b.append(el("span", "zw-bm-farbe-klotz"), el("span", "zw-bm-farbe-wort", f.wort));
      b.addEventListener("click", () => farbe(k));
      farbenLeiste.append(b);
      return b;
    });
    const aktionen = el("div", "zw-bm-aktionen");
    const gemerkt = knopf("Gemerkt!", "zw-bm-gemerkt mini-knopf mini-knopf-voll", () => zug("M"));
    const fertig = knopf("Fertig!", "zw-bm-fertig mini-knopf mini-knopf-voll", () => zug("X"));
    aktionen.append(gemerkt, fertig);
    knoten.append(kopf, flaeche, farbenLeiste, aktionen);

    let letzte = null;
    let felder = [];
    let planFelder = [];
    let gezeigt = { nr: -1, zahl: -1 };

    function raster_bauen(ziel, n, mitKnopf) {
      ziel.innerHTML = "";
      ziel.style.setProperty("--n", String(n));
      const liste = [];
      for (let i = 0; i < n * n; i += 1) {
        const f = el(mitKnopf ? "button" : "span", "zw-bm-feld");
        if (mitKnopf) {
          f.type = "button";
          f.dataset.feld = String(i);
          f.addEventListener("click", () => zug(`Q${i}`));
        }
        ziel.append(f);
        liste.push(f);
      }
      return liste;
    }

    function farbe(k) {
      if (!letzte) return;
      const { lage: l } = letzte;
      if (l.phase === "antworten") zug(`A${k}`);
      else if (l.phase === "setzen") zug(`B${k}`);
    }

    function zeichne(args) {
      const { lage: l, nr, ich, aus, modus, namen } = args;
      letzte = args;
      const n = l.plan.n;
      if (felder.length !== n * n) felder = raster_bauen(raster, n, true);
      if (planFelder.length !== n * n) planFelder = raster_bauen(planBild, n, false);
      const name = (s) => (modus === "computer" && s === "b" ? "Computer" : namen?.[s] || s);
      const meinZug = Boolean(!aus && ich && l.dran === ich && !l.ende);
      const binPlanerin = l.rollen.planerin === (ich || "a");
      // Runden: was geschafft ist.
      runden.innerHTML = "";
      for (let r = 0; r < RUNDEN; r += 1) {
        const e = l.ergebnisse[r];
        const chip = el("span", `zw-bm-runde${e ? (e.richtig ? " ist-ja" : " ist-nein") : r === l.runde && !l.ende ? " ist-jetzt" : ""}`, e ? (e.richtig ? "✓" : "✕") : String(r + 1));
        runden.append(chip);
      }
      rolle.textContent = l.ende ? "" : binPlanerin ? "Du: Planerin \u{1F4DC}" : "Du: Baumeisterin \u{1F9F1}";
      // Der Plan: sichtbar für die Planerin beim Merken – und für beide nach
      // einer Runde (dann mit Haken und Kreuzen).
      const letztes = l.ergebnisse[l.ergebnisse.length - 1];
      const zeigeErgebnis = Boolean(letztes && (l.ende || (l.phase === "merken" && !binPlanerin)));
      const zeigePlan = (l.phase === "merken" && binPlanerin && !l.ende) || zeigeErgebnis;
      planBild.hidden = !zeigePlan;
      raster.hidden = l.phase === "merken" && binPlanerin && !l.ende;
      const planDaten = zeigeErgebnis ? letztes.plan : l.plan.felder;
      planFelder.forEach((f, i) => {
        f.className = `zw-bm-feld ${FARBEN[planDaten[i]].klasse}`;
        if (zeigeErgebnis) f.classList.add(letztes.bau[i] === letztes.plan[i] ? "ist-gleich" : "ist-anders");
      });
      planBild.classList.toggle("ist-ergebnis", zeigeErgebnis);
      // Der Bau: was gesetzt ist, das gefragte Feld leuchtet.
      felder.forEach((f, i) => {
        const daten = zeigeErgebnis && letztes ? letztes.bau : l.bau;
        f.className = `zw-bm-feld ${FARBEN[daten[i]].klasse}${i === l.frage && (l.phase === "antworten" || l.phase === "setzen") ? " ist-frage" : ""}${l.letzter?.art === "B" && l.letzter.feld === i ? " ist-neu" : ""}`;
        f.disabled = !(meinZug && l.phase === "bauen");
        f.setAttribute("aria-label", `Feld ${ORT_WORT(n, i)}${daten[i] ? `, ${FARBEN[daten[i]].wort}` : ""}`);
      });
      // Farben: die Planerin antwortet, die Baumeisterin setzt.
      farbKnoepfe.forEach((b, k) => {
        b.hidden = k > l.plan.farben;
        b.disabled = !(meinZug && (l.phase === "antworten" || l.phase === "setzen"));
        b.classList.toggle("ist-gesagt", l.phase === "setzen" && k === l.antwort && !binPlanerin && false);
      });
      farbenLeiste.hidden = !(l.phase === "antworten" || l.phase === "setzen") || l.ende;
      gemerkt.hidden = !(l.phase === "merken" && binPlanerin && !l.ende);
      gemerkt.disabled = !meinZug;
      fertig.hidden = !(l.phase === "bauen" && !binPlanerin && !l.ende);
      fertig.disabled = !meinZug;
      const neu = nr === gezeigt.nr && l.zahl === gezeigt.zahl + 1;
      if (neu && l.letzter) {
        if (l.letzter.art === "X") ton(letztes?.richtig ? "treffer" : "platsch");
        else if (l.letzter.art === "B") ton("klack");
        else ton("tipp");
      }
      gezeigt = { nr, zahl: l.zahl };
      knoten.dataset.zuege = String(l.zahl);
      knoten.classList.toggle("ist-dran", meinZug);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.dataset.phase = l.phase;
      knoten.setAttribute("aria-label", `Baumeister – ${name(l.rollen.planerin)} plant, ${name(l.rollen.baumeisterin)} baut`);
    }

    return {
      knoten,
      zeichne,
      fokus: () => [gemerkt, fertig, ...farbKnoepfe, ...felder].find((b) => !b.hidden && !b.disabled)?.focus({ preventScroll: true }),
    };
  }

  // Zu zweit wird es mit der Zeit schwerer: der Grad steckt in der Saat.
  function neuePartie(stufe, { nr = 0 } = {}) {
    const grad = stufe ? 0 : Math.min(GRADE.length - 1, 1 + Math.floor((Number(nr) || 0) / 2));
    return { saat: ((grad << 29) | Math.floor(Math.random() * 0x1fffffff)) >>> 0 };
  }

  Z.starte({
    id: "baumeister",
    titel: "Baumeister",
    seite: "baumeister",
    unter: "Zusammen! Eine merkt sich den Plan, die andere baut – sie fragt Feld für Feld, was hinkommt. Jede Runde wird getauscht. Drei von vier Bauten richtig, und ihr habt es geschafft.",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Drei Klötze, zwei Farben" },
      einfach: { name: "Einfach", sterne: 1, satz: "Vier Klötze, drei Farben" },
      mittel: { name: "Mittel", sterne: 2, satz: "Sechs Klötze" },
      schwer: { name: "Schwer", sterne: 3, satz: "Grosses Raster, vier Farben" },
    },
    texte: { start: "los geht's", geschafft: "Geschafft – ihr seid echte Baumeister!", verpasst: "Nicht geschafft – zu viele Bauten waren anders." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie,
    vorlesen: (b) => {
      const l = b.lage;
      if (l.ende) return "";
      return `Runde ${l.runde + 1} von ${RUNDEN}. Geschafft: ${l.ergebnisse.filter((e) => e.richtig).length}.`;
    },
    fuerPruefung: { plan, GRADE, gradVon, RUNDEN, GESCHAFFT_AB, FARBEN },
  });
})();
