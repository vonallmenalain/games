/*
 * muehle.js – Mühle: Steine setzen, ziehen, springen, Mühlen bauen.
 * ---------------------------------------------------------------------------
 * Die Seite /muehle. Ein Brett aus drei Quadraten mit 24 Punkten. Jede hat
 * neun Steine.
 *
 *   Setzen     abwechselnd ein Stein auf einen freien Punkt, bis alle
 *              neun liegen
 *   Ziehen     dann abwechselnd einen eigenen Stein entlang einer Linie
 *              auf den freien Nachbarpunkt
 *   Springen   wer nur noch drei Steine hat, darf auf jeden freien Punkt
 *
 * Drei eigene Steine in einer Reihe sind eine Mühle: Wer sie schliesst,
 * nimmt dem anderen einen Stein weg – nicht aus einer Mühle, ausser alle
 * seine Steine stehen in Mühlen. Wer nur noch zwei Steine hat oder nicht
 * mehr ziehen kann, hat verloren. Werden 60 Züge lang keine Steine mehr
 * genommen (nach dem Setzen), ist es unentschieden.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen das Brett, die Regeln und der Computer.
 *
 * Die Punkte sind nummeriert, aussen beginnend, je Quadrat im Uhrzeigersinn
 * von oben links: 0–7 aussen, 8–15 in der Mitte, 16–23 innen. Ein Zug:
 *
 *   12        einen Stein auf Punkt 12 setzen
 *   3-11      einen Stein von 3 nach 11 ziehen (oder springen)
 *   …x5       und dabei – eine Mühle – den Stein auf Punkt 5 nehmen
 *
 * Durch Punkte getrennt: «0.9.3-11x5…». Wer eröffnet (a), spielt Koralle,
 * das Gegenüber (b) Gold.
 *
 * Der Computer:
 *
 *   leicht    setzt und zieht irgendwohin; eine Mühle schliesst er nur
 *             manchmal
 *   einfach   schliesst eine Mühle, wenn er eine sieht, und verhindert
 *             manchmal eine
 *   mittel    denkt zwei Züge voraus
 *   schwer    denkt so weit voraus, wie es in gut einer halben Sekunde geht
 *             (Alpha-Beta)
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "muehle") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const STEINE = 9;
  const OHNE_NEHMEN = 60;

  // Wo die Punkte liegen (auf einem Raster von 0 bis 6) – und wer mit wem
  // verbunden ist.
  const LAGE = [];
  for (let q = 0; q < 3; q += 1) {
    const a = q; const b = 3; const c = 6 - q;
    // oben links, oben Mitte, oben rechts, rechts Mitte, unten rechts,
    // unten Mitte, unten links, links Mitte
    LAGE.push([a, a], [b, a], [c, a], [c, b], [c, c], [b, c], [a, c], [a, b]);
  }
  const NACHBARN = Array.from({ length: 24 }, () => []);
  const verbinde = (x, y) => { NACHBARN[x].push(y); NACHBARN[y].push(x); };
  for (let q = 0; q < 3; q += 1) for (let i = 0; i < 8; i += 1) verbinde(q * 8 + i, q * 8 + ((i + 1) % 8));
  for (const i of [1, 3, 5, 7]) { verbinde(i, 8 + i); verbinde(8 + i, 16 + i); }
  // Alle Mühlen: je Quadrat die vier Seiten, dazu die vier Querlinien.
  const MUEHLEN = [];
  for (let q = 0; q < 3; q += 1) for (const i of [0, 2, 4, 6]) MUEHLEN.push([q * 8 + i, q * 8 + i + 1, q * 8 + ((i + 2) % 8)]);
  for (const i of [1, 3, 5, 7]) MUEHLEN.push([i, 8 + i, 16 + i]);
  const MUEHLEN_AN = Array.from({ length: 24 }, (_, p) => MUEHLEN.filter((m) => m.includes(p)));

  const inMuehle = (brett, p) => Boolean(brett[p]) && MUEHLEN_AN[p].some((m) => m.every((x) => brett[x] === brett[p]));

  // --- Die Regeln -----------------------------------------------------------------
  function leer(beginnt) {
    return {
      brett: new Array(24).fill(""),
      hand: { a: STEINE, b: STEINE },
      dran: beginnt,
      ende: null,
      ohneNehmen: 0,
      letzter: null,
    };
  }
  const aufBrett = (s, sitz) => s.brett.filter((x) => x === sitz).length;
  const springt = (s, sitz) => s.hand[sitz] === 0 && aufBrett(s, sitz) === 3;

  // Was man nehmen darf: Steine des anderen, nicht aus einer Mühle – ausser
  // alle stehen in Mühlen.
  function nehmbar(brett, wessen) {
    const seine = [];
    for (let p = 0; p < 24; p += 1) if (brett[p] === wessen) seine.push(p);
    const frei = seine.filter((p) => !inMuehle(brett, p));
    return frei.length ? frei : seine;
  }

  // Alle Züge, die sitz jetzt machen darf (mit allen Möglichkeiten zu nehmen).
  function zuege(s, sitz = s.dran) {
    const aus = [];
    if (s.ende || s.dran !== sitz) return aus;
    const b = s.brett;
    const gegen = anderer(sitz);
    const mitNehmen = (grund, nach, von = -1) => {
      if (von >= 0) b[von] = "";
      b[nach] = sitz;
      const muehle = MUEHLEN_AN[nach].some((m) => m.every((x) => b[x] === sitz));
      const ziele = muehle ? nehmbar(b, gegen) : [];
      b[nach] = "";
      if (von >= 0) b[von] = sitz;
      if (muehle && ziele.length) ziele.forEach((x) => aus.push(`${grund}x${x}`));
      else aus.push(grund);
    };
    if (s.hand[sitz] > 0) {
      for (let p = 0; p < 24; p += 1) if (!b[p]) mitNehmen(String(p), p);
      return aus;
    }
    const weit = springt(s, sitz);
    for (let von = 0; von < 24; von += 1) {
      if (b[von] !== sitz) continue;
      const ziele = weit ? [...Array(24).keys()].filter((p) => !b[p]) : NACHBARN[von].filter((p) => !b[p]);
      for (const nach of ziele) mitNehmen(`${von}-${nach}`, nach, von);
    }
    return aus;
  }

  function lies(zug) {
    const m = /^(?:(\d{1,2})-)?(\d{1,2})(?:x(\d{1,2}))?$/.exec(zug);
    if (!m) return null;
    const von = m[1] === undefined ? -1 : Number(m[1]);
    const nach = Number(m[2]);
    const nimmt = m[3] === undefined ? -1 : Number(m[3]);
    if (nach > 23 || von > 23 || nimmt > 23) return null;
    return { von, nach, nimmt };
  }

  // Einen erlaubten Zug ausführen (s wird verändert).
  function ausfuehren(s, zug) {
    const sitz = s.dran;
    const gegen = anderer(sitz);
    const { von, nach, nimmt } = lies(zug);
    if (von >= 0) s.brett[von] = "";
    else s.hand[sitz] -= 1;
    s.brett[nach] = sitz;
    if (nimmt >= 0) s.brett[nimmt] = "";
    const allesGesetzt = s.hand.a === 0 && s.hand.b === 0;
    s.ohneNehmen = nimmt >= 0 || !allesGesetzt ? 0 : s.ohneNehmen + 1;
    s.letzter = { sitz, von, nach, nimmt };
    s.dran = gegen;
    // Verloren: weniger als drei Steine – oder kein Zug mehr.
    if (s.hand[gegen] + aufBrett(s, gegen) < 3) s.ende = sitz;
    else if (!zuege(s, gegen).length) s.ende = sitz;
    else if (s.ohneNehmen >= OHNE_NEHMEN) s.ende = "u";
    if (s.ende) s.dran = null;
    return s;
  }

  function lage(zugliste, { beginnt }) {
    const s = leer(beginnt);
    for (const z of zugliste) {
      if (s.ende || !lies(z) || !zuege(s).includes(z)) return { ...s, dran: null, kaputt: true };
      ausfuehren(s, z);
    }
    return { ...s, springt: { a: springt(s, "a"), b: springt(s, "b") }, legal: s.ende ? [] : zuege(s) };
  }

  const darf = (l, zug, sitz) => l.dran === sitz && Boolean(lies(zug)) && (l.legal || zuege(l, sitz)).includes(zug);

  // --- Der Computer -------------------------------------------------------------
  const kopie = (s) => ({ ...s, brett: [...s.brett], hand: { ...s.hand } });
  const wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];

  // Wie gut steht es für sitz? Steine zählen am meisten, dann Mühlen,
  // halbe Mühlen (zwei und ein freier Punkt) und wie beweglich man ist.
  function bewerte(s, sitz) {
    const gegen = anderer(sitz);
    if (s.ende === sitz) return 10000;
    if (s.ende === gegen) return -10000;
    if (s.ende === "u") return 0;
    const steine = (x) => s.hand[x] + aufBrett(s, x);
    let wert = 120 * (steine(sitz) - steine(gegen));
    for (const m of MUEHLEN) {
      const mein = m.filter((p) => s.brett[p] === sitz).length;
      const sein = m.filter((p) => s.brett[p] === gegen).length;
      const frei = 3 - mein - sein;
      if (mein === 3) wert += 14;
      if (sein === 3) wert -= 14;
      if (mein === 2 && frei === 1) wert += 22;
      if (sein === 2 && frei === 1) wert -= 26;
    }
    if (s.hand[sitz] === 0 && !springt(s, sitz)) wert += 3 * s.brett.reduce((n, x, p) => n + (x === sitz ? NACHBARN[p].filter((q) => !s.brett[q]).length : 0), 0);
    if (s.hand[gegen] === 0 && !springt(s, gegen)) wert -= 3 * s.brett.reduce((n, x, p) => n + (x === gegen ? NACHBARN[p].filter((q) => !s.brett[q]).length : 0), 0);
    return wert;
  }

  function suche(s, tiefe, alpha, beta, sitz, uhr) {
    if (s.ende || tiefe === 0) return bewerte(s, sitz);
    if (uhr.vorbei()) throw uhr;
    const ich = s.dran === sitz;
    const liste = zuege(s);
    // Züge, die nehmen, zuerst – das spart viel.
    liste.sort((x, y) => (y.includes("x") ? 1 : 0) - (x.includes("x") ? 1 : 0));
    let best = ich ? -Infinity : Infinity;
    for (const z of liste) {
      const wert = suche(ausfuehren(kopie(s), z), tiefe - 1, alpha, beta, sitz, uhr);
      if (ich) { if (wert > best) best = wert; if (best > alpha) alpha = best; } else { if (wert < best) best = wert; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    // Ein näherer Sieg ist besser als ein fernerer.
    return best > 5000 ? best - 1 : best < -5000 ? best + 1 : best;
  }

  function besterZug(s, sitz, { tiefe = 2, zeit = 0 } = {}) {
    const liste = zuege(s, sitz);
    if (liste.length === 1) return liste[0];
    const ende = zeit ? Date.now() + zeit : Infinity;
    const uhr = { vorbei: () => Date.now() > ende };
    let beste = liste;
    for (let t = 1; t <= tiefe; t += 1) {
      try {
        let bestWert = -Infinity;
        let neu = [];
        for (const z of liste) {
          const wert = suche(ausfuehren(kopie(s), z), t - 1, -Infinity, Infinity, sitz, uhr);
          if (wert > bestWert) { bestWert = wert; neu = [z]; } else if (wert === bestWert) neu.push(z);
        }
        beste = neu;
        if (bestWert > 5000) break;
      } catch (e) {
        if (e !== uhr) throw e;
        break;
      }
    }
    return wahl(beste);
  }

  function computer(l, sitz, stufe) {
    const s = kopie(l);
    const liste = zuege(s, sitz);
    if (!liste.length) return null;
    const muehlen = liste.filter((z) => z.includes("x"));
    if (stufe === "leicht") {
      if (muehlen.length && Math.random() < 0.2) return wahl(muehlen);
      const ohne = liste.filter((z) => !z.includes("x"));
      return wahl(ohne.length ? ohne : liste);
    }
    if (stufe === "einfach") {
      if (muehlen.length && Math.random() < 0.6) return wahl(muehlen);
      if (Math.random() < 0.2) return besterZug(s, sitz, { tiefe: 2 });
      const ohne = liste.filter((z) => !z.includes("x"));
      return wahl(ohne.length ? ohne : liste);
    }
    if (stufe === "mittel") {
      if (Math.random() < 0.28) {
        if (muehlen.length && Math.random() < 0.8) return wahl(muehlen);
        return wahl(liste);
      }
      return besterZug(s, sitz, { tiefe: 2 });
    }
    return besterZug(s, sitz, { tiefe: 6, zeit: 650 });
  }

  // --- Was über dem Brett steht -----------------------------------------------------
  function satz(l, { ich, name, modus }) {
    // Vor dem ersten Stein: «Du beginnst – setze deinen ersten Stein» (Rahmen).
    if (l.ende || !l.dran || !l.letzter) return null;
    const letzter = l.letzter;
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    if (letzter && letzter.nimmt >= 0) {
      if (letzter.sitz === ich) return { text: "Mühle! Du hast einen Stein genommen.", sitz: ich };
      const text = `${er(letzter.sitz)} hat eine Mühle geschlossen${l.dran === ich ? " – du bist dran." : "."}`;
      return { text, sitz: letzter.sitz };
    }
    if (l.dran === ich) {
      if (l.hand[ich] > 0) return { text: `Du setzt – noch ${l.hand[ich]} ${l.hand[ich] === 1 ? "Stein" : "Steine"}`, sitz: ich };
      if (l.springt?.[ich]) return { text: "Du hast nur noch drei – du darfst springen!", sitz: ich };
      return { text: "Du ziehst – tippe einen Stein an", sitz: ich };
    }
    return null;
  }

  // --- Das Bild -------------------------------------------------------------------
  const NS = "http://www.w3.org/2000/svg";
  const RAND = 8;                         // % Rand
  const FELD = (100 - 2 * RAND) / 6;      // % je Rasterschritt
  const x = (p) => RAND + LAGE[p][0] * FELD;
  const y = (p) => RAND + LAGE[p][1] * FELD;

  function linienSvg(klasse) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("class", klasse);
    svg.setAttribute("aria-hidden", "true");
    const linie = (x1, y1, x2, y2) => {
      const l = document.createElementNS(NS, "line");
      l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
      svg.append(l);
    };
    const gesehen = new Set();
    for (let p = 0; p < 24; p += 1) for (const q of NACHBARN[p]) {
      const k = p < q ? `${p}-${q}` : `${q}-${p}`;
      if (gesehen.has(k)) continue;
      gesehen.add(k);
      linie(x(p), y(p), x(q), y(q));
    }
    return svg;
  }

  function held() {
    const bild = el("div", "zw-mh-held");
    bild.append(linienSvg("zw-mh-linien"));
    // Eine Mühle in Koralle oben, zwei Goldene daneben.
    const steine = { 0: "a", 1: "a", 2: "a", 9: "b", 17: "b", 12: "a", 20: "b", 6: "b" };
    for (const [p, sitz] of Object.entries(steine)) {
      const s = el("span", `zw-mh-held-stein ist-${sitz}${["0", "1", "2"].includes(p) ? " ist-muehle" : ""}`);
      s.style.left = `${x(Number(p))}%`;
      s.style.top = `${y(Number(p))}%`;
      bild.append(s);
    }
    return bild;
  }

  function brett({ zug, ton, ruhig, vorlesen }) {
    const knoten = el("div", "zw-mh");
    const vorrat = { a: el("div", "zw-mh-vorrat ist-a"), b: el("div", "zw-mh-vorrat ist-b") };
    const feld = el("div", "zw-mh-feld");
    feld.append(linienSvg("zw-mh-linien"));
    const punkte = LAGE.map((_, p) => {
      const k = el("button", "zw-mh-punkt");
      k.type = "button";
      k.dataset.punkt = String(p);
      k.style.left = `${x(p)}%`;
      k.style.top = `${y(p)}%`;
      k.addEventListener("click", () => tippe(p));
      feld.append(k);
      return k;
    });
    const steine = el("div", "zw-mh-steine");
    steine.setAttribute("aria-hidden", "true");
    feld.append(steine);
    const hinweis = el("p", "zw-mh-hinweis");
    hinweis.setAttribute("aria-live", "polite");
    hinweis.hidden = true;
    const hinweisText = el("span", "zw-mh-hinweis-text");
    hinweis.append(hinweisText, " ", vorlesen?.(() => hinweisText.textContent) || "");
    knoten.append(vorrat.b, feld, vorrat.a, hinweis);

    let jetzt = null;
    let gewaehlt = -1;      // der Stein, der gezogen werden soll
    let halb = null;        // ein Zug, der noch einen Stein nehmen muss
    let gezeigt = null;     // was zuletzt gezeichnet wurde: { nr, roh }
    const steinKnoten = new Map(); // Punkt → Stein

    function meinZug() {
      const b = jetzt;
      return Boolean(b && !b.aus && b.ich && b.dran === b.ich);
    }
    function moeglich() {
      return meinZug() ? zuege(jetzt.lage, jetzt.ich) : [];
    }

    function tippe(p) {
      if (!meinZug()) return;
      const l = jetzt.lage;
      const alle = moeglich();
      // Erst ein Stein nehmen, weil eine Mühle zu ist.
      if (halb) {
        const z = `${halb}x${p}`;
        if (alle.includes(z)) { halb = null; gewaehlt = -1; zug(z); } else wackeln(punkte[p]);
        return;
      }
      let grund = null;
      if (l.hand[jetzt.ich] > 0) {
        if (!l.brett[p]) grund = String(p);
      } else if (l.brett[p] === jetzt.ich) {
        gewaehlt = gewaehlt === p ? -1 : p;
        ton("tipp");
        zeichne(jetzt);
        return;
      } else if (gewaehlt >= 0 && !l.brett[p]) {
        grund = `${gewaehlt}-${p}`;
      }
      if (!grund) { wackeln(punkte[p]); return; }
      if (alle.includes(grund)) { gewaehlt = -1; zug(grund); return; }
      if (alle.some((z) => z.startsWith(`${grund}x`))) {
        // Eine Mühle: Der Stein steht schon da – jetzt einen nehmen.
        halb = grund;
        ton("treffer");
        zeichne(jetzt);
        return;
      }
      wackeln(punkte[p]);
    }

    function wackeln(k) {
      if (ruhig() || !k.animate) return;
      k.animate([{ transform: "translate(-50%, -50%)" }, { transform: "translate(-62%, -50%)" }, { transform: "translate(-38%, -50%)" }, { transform: "translate(-50%, -50%)" }], { duration: 220 });
    }

    function steinAn(p, sitz) {
      const s = el("span", `zw-mh-stein ist-${sitz}`);
      s.style.left = `${x(p)}%`;
      s.style.top = `${y(p)}%`;
      steine.append(s);
      steinKnoten.set(p, s);
      return s;
    }

    function zeichne(b) {
      jetzt = b;
      const l = b.lage;
      const neuePartie = !gezeigt || gezeigt.nr !== b.nr || !b.roh.startsWith(gezeigt.roh);
      const dazu = neuePartie ? [] : b.roh.slice(gezeigt.roh.length).split(".").filter(Boolean);
      if (!meinZug()) { gewaehlt = -1; halb = null; }

      // Die Steine: nur ein einzelner neuer Zug wird bewegt, sonst neu gelegt.
      const einzeln = dazu.length === 1 && l.letzter && !ruhig();
      if (einzeln) {
        const { von, nach, nimmt, sitz } = l.letzter;
        const s = von >= 0 ? steinKnoten.get(von) : null;
        if (s) {
          steinKnoten.delete(von);
          steinKnoten.set(nach, s);
          s.style.left = `${x(nach)}%`;
          s.style.top = `${y(nach)}%`;
          ton("klack");
        } else {
          const neu = steinAn(nach, sitz);
          neu.classList.add("ist-neu");
          ton("klack");
        }
        if (nimmt >= 0) {
          const weg = steinKnoten.get(nimmt);
          steinKnoten.delete(nimmt);
          if (weg) { weg.classList.add("ist-weg"); window.setTimeout(() => weg.remove(), 450); }
          window.setTimeout(() => ton("treffer"), 160);
        }
      }
      // Stimmt das Bild nicht (neue Partie, mehrere Züge auf einmal): neu legen.
      const stimmt = l.brett.every((sitz, p) => (sitz ? steinKnoten.get(p)?.classList.contains(`ist-${sitz}`) : !steinKnoten.has(p)));
      if (!stimmt) {
        steinKnoten.forEach((s) => s.remove());
        steinKnoten.clear();
        l.brett.forEach((sitz, p) => { if (sitz) steinAn(p, sitz); });
      }
      gezeigt = { nr: b.nr, roh: b.roh };

      // Was man jetzt antippen kann.
      const alle = moeglich();
      const ziele = new Set();
      const waehlbar = new Set();
      const nehmbarJetzt = new Set();
      if (halb) alle.filter((z) => z.startsWith(`${halb}x`)).forEach((z) => nehmbarJetzt.add(Number(z.split("x")[1])));
      else {
        for (const z of alle) {
          const { von, nach } = lies(z);
          if (von < 0) ziele.add(nach);
          else {
            waehlbar.add(von);
            if (von === gewaehlt) ziele.add(nach);
          }
        }
      }
      // Ein halber Zug: Der Stein steht schon (blass) am neuen Ort.
      let vorschau = steine.querySelector(".zw-mh-stein.ist-vorschau");
      if (halb) {
        const { von, nach } = lies(halb);
        if (!vorschau) vorschau = el("span", `zw-mh-stein ist-${b.ich} ist-vorschau`);
        vorschau.style.left = `${x(nach)}%`;
        vorschau.style.top = `${y(nach)}%`;
        steine.append(vorschau);
        steinKnoten.get(von)?.classList.add("ist-unterwegs");
      } else {
        vorschau?.remove();
        steinKnoten.forEach((s) => s.classList.remove("ist-unterwegs"));
      }
      punkte.forEach((k, p) => {
        const sitz = l.brett[p];
        k.className = `zw-mh-punkt${ziele.has(p) ? " ist-ziel" : ""}${waehlbar.has(p) ? " ist-waehlbar" : ""}${p === gewaehlt ? " ist-gewaehlt" : ""}${nehmbarJetzt.has(p) ? " ist-nehmbar" : ""}`;
        k.disabled = !(ziele.has(p) || waehlbar.has(p) || nehmbarJetzt.has(p));
        k.setAttribute("aria-label", `Punkt ${p + 1}${sitz ? (sitz === "a" ? ", Koralle" : ", Gold") : ", frei"}${nehmbarJetzt.has(p) ? ", nehmen" : ""}`);
      });
      steinKnoten.forEach((s, p) => {
        s.classList.toggle("ist-gewaehlt", p === gewaehlt);
        s.classList.toggle("ist-nehmbar", nehmbarJetzt.has(p));
        s.classList.toggle("ist-muehle", inMuehle(l.brett, p));
        s.classList.toggle("ist-letzter", Boolean(l.letzter && l.letzter.nach === p && !l.ende));
      });
      // Die Steine, die noch gesetzt werden: als Reihe neben dem Brett.
      for (const sitz of ["a", "b"]) {
        const v = vorrat[sitz];
        if (v.childElementCount !== l.hand[sitz]) {
          v.innerHTML = "";
          for (let i = 0; i < l.hand[sitz]; i += 1) v.append(el("span", `zw-mh-vorrat-stein ist-${sitz}`));
        }
        v.classList.toggle("ist-leer", l.hand[sitz] === 0);
      }
      knoten.classList.toggle("ist-dran", meinZug());
      knoten.classList.toggle("ist-nehmen", Boolean(halb));
      hinweis.hidden = !halb;
      if (halb) {
        const gegen = anderer(b.ich);
        hinweisText.textContent = `Mühle! Tippe einen Stein ${b.modus === "computer" ? "des Computers" : `von ${b.namen?.[gegen] || "deinem Gegenüber"}`} an – er kommt weg.`;
      }
      knoten.dataset.ich = b.ich || "";
    }

    return {
      knoten,
      zeichne,
      fokus: () => punkte.find((k) => !k.disabled)?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "muehle",
    titel: "Mühle",
    seite: "muehle",
    unter: "Setzt abwechselnd neun Steine, dann zieht ihr. Drei in einer Reihe sind eine Mühle – dann nimmst du einen Stein des anderen. Wer nur noch zwei hat, verliert.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Denkt weit voraus" },
    },
    texte: { start: "setze deinen ersten Stein", remis: "Unentschieden – 60 Züge ohne Mühle." },
    lage,
    darf,
    brett,
    computer,
    satz,
  });
})();
