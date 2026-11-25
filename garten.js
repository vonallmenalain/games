/*
 * garten.js – Gemüsegarten: zusammen säen, giessen, ernten.
 * ---------------------------------------------------------------------------
 * Die Seite /garten. Ein ruhiges Spiel miteinander, Zug um Zug. Ein Garten
 * mit neun Beeten. Jeden Tag ist jede einmal dran, dann kommt die Nacht.
 *
 * Ein Tipp auf ein Beet tut, was das Beet gerade braucht:
 *   leer           → säen (der Samen bekommt gleich etwas Wasser)
 *   eine Schnecke  → die Schnecke wegtragen
 *   reif           → ernten (in den Korb)
 *   sonst          → giessen (die Kanne füllt das Beet ganz)
 *
 * In der Nacht wächst jede Pflanze, die Wasser hat, um eine Stufe (Samen →
 * Keimling → Pflanze → reif) und braucht dabei Wasser auf. Ohne Wasser
 * bleibt sie stehen; zwei Nächte ohne Wasser, und sie welkt. Manche Nacht
 * regnet es (das steht oben: «Heute Nacht: Regen»), dann sind alle Beete
 * nass. Ab «Einfach» kommen Schnecken: Eine Schnecke frisst in der nächsten
 * Nacht die Pflanze, wenn niemand sie wegträgt.
 *
 * Ziel: genug Gemüse im Korb, bevor die Tage um sind.
 *
 * Wetter und Schnecken kommen aus der Saat; wie viele Tage und wie viel
 * Gemüse aus der Stufe (gegen den Computer) oder, zu zweit, der wievielten
 * Partie. Ein Zug ist «P4» (säen in Beet 4), «G4» (giessen), «E4»
 * (ernten) oder «S4» (Schnecke weg) – immer das, was das Beet braucht.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "garten") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = (s) => (s === "a" ? "b" : "a");

  const BEETE = 9;
  const REIF = 4;
  const STUFE_GRAD = { leicht: 0, einfach: 1, mittel: 2, schwer: 3 };
  // Je Grad: Tage, so viel Gemüse muss in den Korb, wie oft es regnet, wie
  // viele Schnecken kommen.
  const GRADE = [
    { tage: 8, ziel: 4, regen: 0.4, schnecken: 0 },
    { tage: 9, ziel: 4, regen: 0.35, schnecken: 2 },
    { tage: 11, ziel: 5, regen: 0.3, schnecken: 3 },
    { tage: 12, ziel: 6, regen: 0.26, schnecken: 4 },
  ];
  const GEMUESE = ["\u{1F955}", "\u{1F345}", "\u{1F33D}", "\u{1F383}", "\u{1F952}", "\u{1F353}"];
  const GEMUESE_NAME = ["Karotte", "Tomate", "Mais", "Kürbis", "Gurke", "Erdbeere"];

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
  const gradVon = (saat, stufe) => (stufe && STUFE_GRAD[stufe] !== undefined ? STUFE_GRAD[stufe] : Math.min(3, (Number(saat) >>> 29) & 3));

  // Das Jahr im Garten: in welchen Nächten es regnet, in welchen eine
  // Schnecke kommt (nie in der ersten und nie in den letzten zwei), und
  // welches Beet sie sich sucht (eine Reihenfolge je Nacht).
  function planVon(saat, stufe) {
    const grad = gradVon(saat, stufe);
    const g = GRADE[grad];
    const rnd = wuerfel(((Number(saat) >>> 0) ^ 0x9a7d) >>> 0);
    const regen = [];
    for (let d = 0; d < g.tage; d += 1) regen.push(rnd() < g.regen && !(d > 0 && regen[d - 1] && regen[d - 2]));
    const moeglich = [];
    for (let d = 1; d < g.tage - 2; d += 1) moeglich.push(d);
    const schnecken = [];
    while (schnecken.length < g.schnecken && moeglich.length) schnecken.push(moeglich.splice(Math.floor(rnd() * moeglich.length), 1)[0]);
    schnecken.sort((x, y) => x - y);
    const vorliebe = [];
    for (let d = 0; d < g.tage; d += 1) {
      const r = [...Array(BEETE).keys()];
      for (let i = r.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
      vorliebe.push(r);
    }
    return { grad, tage: g.tage, ziel: g.ziel, regen, schnecken, vorliebe };
  }

  // --- Der Garten -------------------------------------------------------------------
  const leer = () => ({ stufe: 0, wasser: 0, durst: 0, schnecke: false, art: 0 });

  function start(plan) {
    return { tag: 0, zugImTag: 0, beete: Array.from({ length: BEETE }, leer), korb: 0, gesaet: 0, ende: null, nacht: null, geerntet: [] };
  }

  // Was ein Tipp auf das Beet tut.
  function tatVon(b) {
    if (b.schnecke) return "S";
    if (b.stufe >= REIF) return "E";
    if (b.stufe === 0) return "P";
    return "G";
  }

  function tun(s, tat, i) {
    const b = s.beete[i];
    if (tat === "P") { s.beete[i] = { stufe: 1, wasser: 1, durst: 0, schnecke: false, art: s.gesaet % GEMUESE.length }; s.gesaet += 1; }
    else if (tat === "G") { b.wasser = 2; b.durst = 0; }
    else if (tat === "E") { s.geerntet.push(b.art); s.korb += 1; s.beete[i] = leer(); }
    else if (tat === "S") b.schnecke = false;
  }

  // Die Nacht nach dem Tag d: Schnecken fressen, Regen, Wachsen, neue
  // Schnecke. Was geschah, steht in s.nacht (fürs Bild).
  function nacht(s, plan, d) {
    const n = { tag: d, gefressen: [], regen: Boolean(plan.regen[d]), gewachsen: [], gewelkt: [], schnecke: null };
    s.beete.forEach((b, i) => {
      if (!b.schnecke) return;
      n.gefressen.push(i);
      s.beete[i] = leer();
    });
    if (n.regen) s.beete.forEach((b) => { if (b.stufe > 0 && b.stufe < REIF) { b.wasser = 2; b.durst = 0; } });
    s.beete.forEach((b, i) => {
      if (b.stufe === 0 || b.stufe >= REIF) return;
      if (b.wasser > 0) { b.stufe += 1; b.wasser -= 1; b.durst = 0; n.gewachsen.push(i); return; }
      b.durst += 1;
      if (b.durst >= 2) { n.gewelkt.push(i); s.beete[i] = leer(); }
    });
    if (plan.schnecken.includes(d)) {
      // Die Schnecke mag es saftig: die grösste Pflanze (ab Keimling).
      const kandidaten = plan.vorliebe[d].filter((i) => s.beete[i].stufe >= 2 && !s.beete[i].schnecke);
      kandidaten.sort((x, y) => s.beete[y].stufe - s.beete[x].stufe);
      if (kandidaten.length) { s.beete[kandidaten[0]].schnecke = true; n.schnecke = kandidaten[0]; }
    }
    s.nacht = n;
  }

  // --- Die Regeln -----------------------------------------------------------------
  const ZUG = /^([PGES])([0-8])$/;

  function lage(zuege, { beginnt = "a", saat, stufe }) {
    const plan = planVon(saat, stufe);
    const s = start(plan);
    let dran = beginnt;
    let letzter = null;
    for (const z of zuege) {
      const m = ZUG.exec(z);
      if (!m || s.ende || tatVon(s.beete[Number(m[2])]) !== m[1]) return { plan, ...s, beginnt, dran: null, kaputt: true, letzter, zahl: zuege.length };
      const i = Number(m[2]);
      s.nacht = null;
      tun(s, m[1], i);
      letzter = { wer: dran, tat: m[1], beet: i, tag: s.tag };
      if (s.korb >= plan.ziel) { s.ende = "g"; break; }
      s.zugImTag += 1;
      dran = anderer(dran);
      if (s.zugImTag === 2) {
        nacht(s, plan, s.tag);
        s.tag += 1;
        s.zugImTag = 0;
        dran = beginnt;
        if (s.tag >= plan.tage) s.ende = "v";
      }
    }
    return { plan, ...s, beginnt, dran: s.ende ? null : dran, letzter, zahl: zuege.length };
  }

  function darf(l, zug, sitz) {
    if (l.ende || l.kaputt || l.dran !== sitz) return false;
    const m = ZUG.exec(zug);
    return Boolean(m && tatVon(l.beete[Number(m[2])]) === m[1]);
  }

  // --- Was eine gute Gärtnerin tut (der Computer, und die Prüfung) ------------
  function guterZug(l) {
    const { plan, beete, tag } = l;
    const regenHeute = Boolean(plan.regen[tag]);
    const zug = (i) => `${tatVon(beete[i])}${i}`;
    const alle = [...Array(BEETE).keys()];
    const schnecke = alle.find((i) => beete[i].schnecke);
    if (schnecke !== undefined) return zug(schnecke);
    const reif = alle.find((i) => beete[i].stufe >= REIF);
    const waechst = alle.filter((i) => beete[i].stufe > 0 && beete[i].stufe < REIF);
    const durstig = regenHeute ? [] : waechst.filter((i) => beete[i].wasser === 0).sort((x, y) => beete[y].durst - beete[x].durst || beete[y].stufe - beete[x].stufe);
    // Am letzten Tag zählt nur noch die Ernte; sonst zuerst, was heute
    // Nacht welken würde.
    if (reif !== undefined && tag === plan.tage - 1) return zug(reif);
    if (durstig.length && beete[durstig[0]].durst >= 1) return zug(durstig[0]);
    if (reif !== undefined) return zug(reif);
    if (durstig.length) return zug(durstig[0]);
    // Säen lohnt, solange der Samen noch reif wird (drei Nächte) und man
    // ihn dann ernten kann – und nicht mehr Pflanzen, als man versorgt.
    const leere = alle.filter((i) => beete[i].stufe === 0);
    if (leere.length && tag + 3 < plan.tage && waechst.length < 5) return zug(leere[0]);
    if (!regenHeute) {
      const halb = waechst.filter((i) => beete[i].wasser === 1).sort((x, y) => beete[x].stufe - beete[y].stufe);
      if (halb.length) return zug(halb[0]);
    }
    if (leere.length) return zug(leere[0]);
    return zug(waechst[0] ?? 0);
  }

  // Wer es schlecht macht: sät alles voll und giesst, erntet aber nie.
  function schlechterZug(l) {
    const alle = [...Array(BEETE).keys()];
    const leer0 = alle.find((i) => l.beete[i].stufe === 0);
    if (leer0 !== undefined) return `P${leer0}`;
    const nichtReif = alle.find((i) => l.beete[i].stufe < REIF && !l.beete[i].schnecke);
    if (nichtReif !== undefined) return `G${nichtReif}`;
    const i = alle.find((k) => !l.beete[k].schnecke) ?? 0;
    return `${tatVon(l.beete[i])}${i}`;
  }

  function computer(l, sitz) {
    if (l.ende || l.dran !== sitz) return null;
    return { zug: guterZug(l), warte: 900 + Math.random() * 400 };
  }

  // Eine ganze Partie, beide gut (oder beide schlecht) – für die Prüfungen.
  function partie(saat, stufe, { beginnt = "a", gut = true } = {}) {
    const zuege = [];
    for (let k = 0; k < 60; k += 1) {
      const l = lage(zuege, { beginnt, saat, stufe });
      if (l.ende || !l.dran) break;
      zuege.push(gut ? guterZug(l) : schlechterZug(l));
    }
    return { zuege, lage: lage(zuege, { beginnt, saat, stufe }) };
  }

  // --- Was über dem Garten steht ---------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !l.dran) return null;
    if (l.dran === ich && !l.zahl) return { text: "Du beginnst – tippe ein Beet zum Säen!", sitz: ich };
    if (l.dran === ich && l.nacht) {
      const n = l.nacht;
      const was = n.gefressen.length ? "Eine Schnecke hat gefressen!" : n.gewelkt.length ? "Eine Pflanze ist verwelkt – sie hatte Durst." : n.schnecke !== null ? "Eine Schnecke ist da – trag sie weg!" : n.regen ? "Es hat geregnet." : "Ein neuer Tag.";
      return { text: `${was} Du bist dran.`, sitz: ich };
    }
    if (l.dran !== ich && modus === "computer") return null;
    return null;
  }

  // --- Das Bild -------------------------------------------------------------------
  const TAT_ZEICHEN = { P: "\u{1F331}", G: "\u{1F4A7}", E: "✂️", S: "✋" };
  const TAT_NAME = { P: "säen", G: "giessen", E: "ernten", S: "Schnecke wegtragen" };
  const STUFE_NAME = ["leer", "Samen", "Keimling", "Pflanze", "reif"];

  function held() {
    const bild = el("div", "zw-gg-held");
    ["\u{1F955}", "\u{1F331}", "\u{1F345}", "\u{1F33F}"].forEach((z, i) => bild.append(el("span", `zw-gg-held-beet ist-${i}`, z)));
    bild.append(el("span", "zw-gg-held-kanne", "\u{1F4A7}"));
    return bild;
  }

  function brett({ zug, ruhig, ton }) {
    const knoten = el("div", "vr-feld zw-gg");
    knoten.dataset.zuege = "0";
    const kopf = el("div", "zw-gg-kopf");
    const tagEl = el("span", "zw-gg-tag");
    const wetter = el("span", "zw-gg-wetter");
    const korb = el("span", "zw-gg-korb");
    kopf.append(tagEl, wetter, korb);
    const garten = el("div", "zw-gg-garten");
    const beete = [...Array(BEETE).keys()].map((i) => {
      const b = el("button", "zw-gg-beet");
      b.type = "button";
      b.dataset.beet = String(i);
      const pflanze = el("span", "zw-gg-pflanze");
      const wasser = el("span", "zw-gg-wasser");
      wasser.append(el("span", "zw-gg-tropfen"), el("span", "zw-gg-tropfen"));
      const schnecke = el("span", "zw-gg-schnecke", "\u{1F40C}");
      const tat = el("span", "zw-gg-tat");
      b.append(pflanze, wasser, schnecke, tat);
      b.addEventListener("click", () => tippen(i));
      garten.append(b);
      return { b, pflanze, wasser, schnecke, tat };
    });
    const nachtEl = el("div", "zw-gg-nacht");
    nachtEl.append(el("span", "zw-gg-mond", "\u{1F319}"));
    garten.append(nachtEl);
    const ernte = el("div", "zw-gg-ernte");
    knoten.append(kopf, garten, ernte);

    let letzte = null;
    let gezeigt = { nr: -1, tag: -1, zahl: -1 };
    let nachtUhr = 0;

    function tippen(i) {
      if (!letzte) return;
      const { lage: l, ich, aus } = letzte;
      if (aus || !ich || l.dran !== ich || l.ende) return;
      const t = tatVon(l.beete[i]);
      if (zug(`${t}${i}`) !== false) ton?.(t === "E" ? "da" : t === "S" ? "klack" : t === "G" ? "platsch" : "tipp");
    }

    function zeichne(args) {
      const { lage: l, nr, ich, aus } = args;
      letzte = args;
      const meins = Boolean(ich && l.dran === ich && !aus && !l.ende);
      l.beete.forEach((b, i) => {
        const e = beete[i];
        const t = tatVon(b);
        e.b.className = `zw-gg-beet ist-stufe-${b.stufe}${b.wasser ? ` ist-nass-${b.wasser}` : ""}${b.stufe > 0 && b.stufe < REIF && !b.wasser ? " ist-durstig" : ""}${b.schnecke ? " ist-schnecke" : ""}`;
        e.b.dataset.tat = t;
        e.b.disabled = !meins;
        e.pflanze.textContent = b.stufe === 0 ? "" : b.stufe === 1 ? "" : b.stufe === 2 ? "\u{1F331}" : b.stufe === 3 ? "\u{1F33F}" : GEMUESE[b.art];
        e.wasser.hidden = b.stufe === 0 || b.stufe >= REIF;
        e.schnecke.hidden = !b.schnecke;
        e.tat.textContent = TAT_ZEICHEN[t];
        e.tat.hidden = !meins;
        const art = b.stufe >= REIF ? GEMUESE_NAME[b.art] : STUFE_NAME[b.stufe];
        e.b.setAttribute("aria-label", `Beet ${i + 1}: ${art}${b.stufe > 0 && b.stufe < REIF ? `, ${b.wasser ? "Wasser" : "durstig"}` : ""}${b.schnecke ? ", eine Schnecke" : ""} – tippen: ${TAT_NAME[t]}`);
      });
      const tagNr = Math.min(l.tag + 1, l.plan.tage);
      tagEl.textContent = `Tag ${tagNr} / ${l.plan.tage}`;
      const regen = !l.ende && l.plan.regen[l.tag];
      wetter.innerHTML = "";
      if (!l.ende) wetter.append(el("span", "zw-gg-wetter-zeichen", regen ? "\u{1F327}\uFE0F" : "\u2600\uFE0F"), el("span", "zw-gg-wetter-text", regen ? "Nachts Regen" : "Trocken"));
      wetter.setAttribute("aria-label", regen ? "Heute Nacht regnet es" : "Heute Nacht regnet es nicht");
      wetter.classList.toggle("ist-regen", Boolean(regen));
      korb.textContent = `Ernte ${l.korb} / ${l.plan.ziel}`;
      ernte.innerHTML = "";
      for (let k = 0; k < l.plan.ziel; k += 1) ernte.append(el("span", `zw-gg-korbplatz${k < l.korb ? " ist-voll" : ""}`, k < l.korb ? GEMUESE[l.geerntet[k]] : ""));
      // Eine neue Nacht: kurz dunkel (mit Regen, wenn es regnete).
      if (nr === gezeigt.nr && l.tag > gezeigt.tag && l.nacht && !ruhig()) {
        garten.classList.toggle("ist-regen", l.nacht.regen);
        garten.classList.remove("ist-nacht");
        void garten.offsetWidth;
        garten.classList.add("ist-nacht");
        window.clearTimeout(nachtUhr);
        nachtUhr = window.setTimeout(() => garten.classList.remove("ist-nacht", "ist-regen"), 1300);
        if (l.nacht.gefressen.length || l.nacht.gewelkt.length) ton?.("treffer");
      }
      // Am Ende steht der Garten hell da.
      if (l.ende) { window.clearTimeout(nachtUhr); garten.classList.remove("ist-nacht", "ist-regen"); }
      gezeigt = { nr, tag: l.tag, zahl: l.zahl };
      knoten.dataset.zuege = String(l.zahl);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.classList.toggle("ist-geschafft", l.ende === "g");
    }

    return {
      knoten,
      zeichne,
      fokus: () => (beete.find((e) => !e.b.disabled) || beete[0]).b.focus({ preventScroll: true }),
    };
  }

  // Zu zweit wird es mit jeder zweiten Partie mehr Gemüse (und Schnecken).
  function neuePartie(stufe, { nr = 0 } = {}) {
    const grad = stufe ? 0 : Math.min(3, Math.floor((Number(nr) || 0) / 2));
    return { saat: ((grad << 29) | Math.floor(Math.random() * 0x1fffffff)) >>> 0 };
  }

  Z.starte({
    id: "garten",
    titel: "Gemüsegarten",
    seite: "garten",
    unter: "Zusammen! Abwechselnd ein Beet antippen: säen, giessen, ernten, Schnecken wegtragen. In der Nacht wächst, was Wasser hat. Bringt genug Gemüse in den Korb!",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Vier Gemüse in acht Tagen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Vier Gemüse, zwei Schnecken" },
      mittel: { name: "Mittel", sterne: 2, satz: "Fünf Gemüse, drei Schnecken" },
      schwer: { name: "Schwer", sterne: 3, satz: "Sechs Gemüse, vier Schnecken, wenig Regen" },
    },
    texte: { start: "tippe ein Beet", geschafft: "Geschafft – der Korb ist voll!", verpasst: "Die Tage sind um – nicht geschafft." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie,
    vorlesen: (b) => (b.lage.ende ? "" : `Tag ${b.lage.tag + 1} von ${b.lage.plan.tage}. Im Korb: ${b.lage.korb} von ${b.lage.plan.ziel}. ${b.lage.plan.regen[b.lage.tag] ? "Heute Nacht regnet es." : "Heute Nacht regnet es nicht."}`),
    fuerPruefung: { planVon, guterZug, schlechterZug, partie, tatVon, gradVon, GRADE, BEETE, REIF },
  });
})();
