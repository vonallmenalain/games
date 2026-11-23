/*
 * farbcode.js – Farbcode knacken: einen Code verstecken, den des anderen
 * erraten.
 * ---------------------------------------------------------------------------
 * Die Seite /farbcode. Jede versteckt einen Code aus vier Farben (von sechs;
 * eine Farbe darf mehrmals vorkommen, auch viermal). Dann rät jede
 * abwechselnd den Code der anderen. Auf jeden Versuch kommt die Antwort: wie
 * viele Stifte die richtige Farbe am richtigen Platz haben (grün) und wie
 * viele weitere Farben im Code vorkommen, aber anderswo (gelb) – jede Farbe
 * höchstens so oft, wie sie im Code steht.
 *
 * Eingeben: eine Farbe antippen (sie bleibt gewählt), dann den Platz, auf den
 * sie soll – in beliebiger Reihenfolge. Ohne gewählte Farbe leert ein Tipp den
 * Platz.
 *
 * Wer zuerst knackt, gewinnt – aber eine Runde ist erst fertig, wenn beide
 * gleich oft geraten haben: Knackt die andere in derselben Runde auch, ist
 * es unentschieden. Nach acht Versuchen ohne Treffer ebenfalls. Am Ende
 * zeigt jede den Code, den die andere nicht geknackt hat.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen das Brett, die Regeln und der Computer.
 *
 * Der eigene Code bleibt auf dem Gerät (localStorage, «farbcode.codes», je
 * Raum, Partie und Platz), wie die Flotte bei Schiffe versenken: Auf einen
 * Versuch antwortet das Gerät des Code-Besitzers von selbst (auto). Fehlt der
 * Code dort, nimmt es einen, der zu allen bisherigen Antworten passt. Gegen
 * den Computer liegt dessen Code in der Saat der Partie.
 *
 * Züge, durch Punkte getrennt (Farben 1–6):
 *
 *   Ca, Cb      a (oder b) hat den Code versteckt
 *   R2461       ein Versuch: rot? – vier Ziffern, je eine Farbe
 *   A21         die Antwort: 2 am richtigen Platz, 1 anderswo
 *   Z1352       am Ende: der eigene Code, zum Zeigen
 *
 * Der Computer:
 *
 *   leicht    rät oft einfach drauflos, achtet manchmal auf die letzte
 *             Antwort
 *   einfach   achtet auf die letzte Antwort, manchmal auf alle
 *   mittel    rät meist nur Codes, die zu allen Antworten passen
 *   schwer    beginnt mit zwei Farben je doppelt und wählt dann den
 *             Versuch, der am meisten verrät (wie Knuth)
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "farbcode") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const PLAETZE = 4;
  const FARBEN = 6;
  const VERSUCHE = 8;
  const SPEICHER = "farbcode.codes";
  const FARB_NAMEN = ["Rot", "Orange", "Gelb", "Grün", "Blau", "Lila"];

  // Alle 1296 Codes: vier Plätze, je eine von sechs Farben – auch doppelt.
  const ALLE = [];
  for (let a = 1; a <= FARBEN; a += 1) for (let b = 1; b <= FARBEN; b += 1) for (let c = 1; c <= FARBEN; c += 1) for (let d = 1; d <= FARBEN; d += 1) {
    ALLE.push(`${a}${b}${c}${d}`);
  }
  const gueltig = (code) => /^[1-6]{4}$/.test(code);

  // Die Antwort auf einen Versuch: [am Platz, anderswo]. Was am Platz stimmt,
  // zählt nur dort; vom Rest zählt jede Farbe so oft, wie sie in beiden
  // vorkommt (Code 1123, Versuch 3111: einer am Platz, zwei anderswo).
  const restCode = new Uint8Array(FARBEN + 1);
  const restVersuch = new Uint8Array(FARBEN + 1);
  function antwort(code, versuch) {
    let platz = 0;
    restCode.fill(0);
    restVersuch.fill(0);
    for (let i = 0; i < PLAETZE; i += 1) {
      if (versuch[i] === code[i]) platz += 1;
      else { restCode[code.charCodeAt(i) - 48] += 1; restVersuch[versuch.charCodeAt(i) - 48] += 1; }
    }
    let da = 0;
    for (let f = 1; f <= FARBEN; f += 1) da += Math.min(restCode[f], restVersuch[f]);
    return [platz, da];
  }

  // --- Die Regeln -----------------------------------------------------------------
  /*
   * Die Lage: phase «verstecken» (beide), «raten» (dran rät), «antworten»
   * (dran ist der Code-Besitzer), «zeigen» (dran zeigt seinen Code), dann
   * das Ende. versuche[x]: was x geraten hat, mit Antwort.
   */
  function lage(zuege, { beginnt }) {
    const l = {
      phase: "verstecken",
      dran: "beide",
      ende: null,
      bereit: { a: false, b: false },
      versuche: { a: [], b: [] },
      geknackt: { a: 0, b: 0 },
      gezeigt: { a: "", b: "" },
      offen: null,
      zeigen: [],
      sieger: null,
    };
    const kaputt = () => ({ ...l, dran: null, kaputt: true });
    const zweiter = anderer(beginnt);
    for (const z of zuege) {
      if (l.phase === "verstecken") {
        const m = /^C([ab])$/.exec(z);
        if (!m || l.bereit[m[1]]) return kaputt();
        l.bereit[m[1]] = true;
        if (l.bereit.a && l.bereit.b) { l.phase = "raten"; l.dran = beginnt; }
      } else if (l.phase === "raten") {
        const m = /^R([1-6]{4})$/.exec(z);
        if (!m || !gueltig(m[1])) return kaputt();
        l.offen = { von: l.dran, versuch: m[1] };
        l.phase = "antworten";
        l.dran = anderer(l.offen.von);
      } else if (l.phase === "antworten") {
        const m = /^A([0-4])([0-4])$/.exec(z);
        const platz = m ? Number(m[1]) : -1;
        const da = m ? Number(m[2]) : -1;
        if (!m || platz + da > PLAETZE || (platz === 3 && da === 1)) return kaputt();
        const { von, versuch } = l.offen;
        l.versuche[von].push({ versuch, platz, da });
        if (platz === PLAETZE && !l.geknackt[von]) l.geknackt[von] = l.versuche[von].length;
        l.offen = null;
        // Eine Runde ist fertig, wenn der Zweite so oft geraten hat wie der
        // Erste. Dann wird entschieden.
        const runde = l.versuche[zweiter].length;
        const rundeFertig = von === zweiter;
        let entschieden = false;
        if (rundeFertig) {
          const ka = l.geknackt[beginnt];
          const kb = l.geknackt[zweiter];
          if (ka && kb) { l.sieger = "u"; entschieden = true; } else if (ka) { l.sieger = beginnt; entschieden = true; } else if (kb) { l.sieger = zweiter; entschieden = true; } else if (runde >= VERSUCHE) { l.sieger = "u"; entschieden = true; }
        }
        if (entschieden) {
          // Wer zeigt seinen Code? Jeder, dessen Code nicht geknackt wurde.
          l.zeigen = ["a", "b"].filter((x) => !l.geknackt[anderer(x)]);
          if (l.zeigen.length) { l.phase = "zeigen"; l.dran = l.zeigen[0]; } else { l.phase = "ende"; l.ende = l.sieger; l.dran = null; }
        } else {
          l.phase = "raten";
          l.dran = anderer(von);
        }
      } else if (l.phase === "zeigen") {
        const m = /^Z([1-6]{4})$/.exec(z);
        if (!m || !gueltig(m[1])) return kaputt();
        l.gezeigt[l.dran] = m[1];
        l.zeigen = l.zeigen.filter((x) => x !== l.dran);
        if (l.zeigen.length) l.dran = l.zeigen[0];
        else { l.phase = "ende"; l.ende = l.sieger; l.dran = null; }
      } else return kaputt();
    }
    return l;
  }

  function darf(l, zug, sitz) {
    if (l.phase === "verstecken") return zug === `C${sitz}` && !l.bereit[sitz];
    if (l.dran !== sitz) return false;
    if (l.phase === "raten") { const m = /^R([1-6]{4})$/.exec(zug); return Boolean(m) && gueltig(m[1]); }
    if (l.phase === "antworten") { const m = /^A([0-4])([0-4])$/.exec(zug); return Boolean(m) && Number(m[1]) + Number(m[2]) <= PLAETZE && !(m[1] === "3" && m[2] === "1"); }
    if (l.phase === "zeigen") { const m = /^Z([1-6]{4})$/.exec(zug); return Boolean(m) && gueltig(m[1]); }
    return false;
  }

  // --- Der eigene Code, auf diesem Gerät ------------------------------------------
  const schluessel = (raum, nr, sitz) => `${raum}|${nr}|${sitz}`;
  function codesLesen() { try { return JSON.parse(localStorage.getItem(SPEICHER) || "{}") || {}; } catch { return {}; } }
  function codeMerken(raum, nr, sitz, code) {
    const alle = codesLesen();
    alle[schluessel(raum, nr, sitz)] = { c: code, t: Date.now() };
    const behalten = Object.entries(alle).sort((x, y) => (y[1]?.t || 0) - (x[1]?.t || 0)).slice(0, 12);
    try { localStorage.setItem(SPEICHER, JSON.stringify(Object.fromEntries(behalten))); } catch { /* nur im Kopf */ }
  }
  const passtZu = (code, versuche) => versuche.every(({ versuch, platz, da }) => { const [p, d] = antwort(code, versuch); return p === platz && d === da; });
  function meinCode(raum, nr, sitz, l) {
    const da = codesLesen()[schluessel(raum, nr, sitz)]?.c;
    const geraten = l.versuche[anderer(sitz)];
    if (gueltig(da || "") && passtZu(da, geraten)) return da;
    const passend = ALLE.filter((c) => passtZu(c, geraten));
    const neu = passend[Math.floor(Math.random() * passend.length)] || null;
    if (neu) codeMerken(raum, nr, sitz, neu);
    return neu;
  }

  function auto(l, sitz, { raum, nr }) {
    if (l.dran !== sitz || (l.phase !== "antworten" && l.phase !== "zeigen")) return null;
    const code = meinCode(raum, nr, sitz, l);
    if (!code) return null;
    if (l.phase === "zeigen") return `Z${code}`;
    const [platz, da] = antwort(code, l.offen.versuch);
    return `A${platz}${da}`;
  }

  // --- Der Computer -------------------------------------------------------------
  function computerCode(saat) {
    let t = (Number(saat) ^ 0xc0de) >>> 0 || 1;
    t = Math.imul(t ^ (t >>> 16), 0x45d9f3b) >>> 0;
    return ALLE[t % ALLE.length];
  }
  const wahl = (liste) => liste[Math.floor(Math.random() * liste.length)];

  // Der Versuch, nach dem im schlimmsten Fall am wenigsten Codes übrig sind.
  // Bei vielen Kandidaten prüft er nur einen Teil aller Codes als Versuch.
  const gruppen = new Uint16Array(25);
  function bester(kandidaten) {
    if (kandidaten.length <= 2) return kandidaten[0];
    const drin = new Set(kandidaten);
    let best = null;
    let bestWert = Infinity;
    const pool = kandidaten.length > 60 ? ALLE.filter((_, i) => i % 5 === 0).concat(kandidaten.slice(0, 40)) : ALLE;
    for (const v of pool) {
      gruppen.fill(0);
      let schlimmst = 0;
      for (const c of kandidaten) {
        const [p, d] = antwort(c, v);
        const k = p * 5 + d;
        gruppen[k] += 1;
        if (gruppen[k] > schlimmst) schlimmst = gruppen[k];
      }
      const wert = schlimmst - (drin.has(v) ? 0.5 : 0);
      if (wert < bestWert) { bestWert = wert; best = v; }
    }
    return best;
  }
  // Der erste Versuch von «Schwer»: zwei Farben, je doppelt (wie 1122).
  function ersterVersuch() {
    const x = 1 + Math.floor(Math.random() * FARBEN);
    const y = 1 + ((x + Math.floor(Math.random() * (FARBEN - 1))) % FARBEN);
    return `${x}${x}${y}${y}`;
  }

  function computer(l, sitz, stufe, { saat }) {
    if (l.phase === "verstecken") return l.bereit[sitz] ? null : { zug: `C${sitz}`, warte: 600 };
    if (l.dran !== sitz) return null;
    const code = computerCode(saat);
    if (l.phase === "antworten") { const [p, d] = antwort(code, l.offen.versuch); return { zug: `A${p}${d}`, warte: 500 }; }
    if (l.phase === "zeigen") return { zug: `Z${code}`, warte: 300 };
    const meine = l.versuche[sitz];
    const passend = ALLE.filter((c) => passtZu(c, meine));
    const nurLetzte = meine.length ? ALLE.filter((c) => passtZu(c, meine.slice(-1))) : ALLE;
    let versuch;
    const r = Math.random();
    if (stufe === "leicht") versuch = r < 0.08 ? wahl(passend) : r < 0.45 ? wahl(nurLetzte) : wahl(ALLE);
    else if (stufe === "einfach") versuch = r < 0.35 ? wahl(passend) : wahl(nurLetzte);
    else if (stufe === "mittel") versuch = r < 0.75 ? wahl(passend) : wahl(nurLetzte);
    else versuch = meine.length === 0 ? ersterVersuch() : bester(passend);
    return { zug: `R${versuch || wahl(ALLE)}`, warte: 900 };
  }

  // --- Was über dem Brett steht -----------------------------------------------------
  function satz(l, { ich, name, modus }) {
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    if (l.phase === "verstecken") {
      if (ich && !l.bereit[ich]) return { text: "Versteck deinen Code: vier Farben (auch doppelt), dann «Fertig!»", sitz: ich };
      if (ich) return { text: modus === "computer" ? "Der Computer versteckt seinen Code" : `${name(anderer(ich))} versteckt noch den Code`, sitz: anderer(ich) };
      return { text: "Beide verstecken ihren Code", sitz: null };
    }
    if (l.ende) {
      if (l.ende === "u") return { text: l.geknackt.a && l.geknackt.b ? "Beide geknackt – unentschieden!" : "Niemand hat geknackt – unentschieden.", sitz: null };
      if (l.ende === ich) return { text: `Geknackt – du hast gewonnen!`, sitz: ich };
      return { text: `${er(l.ende)} hat gewonnen${ich ? " – dein Code ist geknackt." : "."}`, sitz: l.ende };
    }
    if (l.phase === "zeigen") return { text: "Jetzt werden die Codes gezeigt …", sitz: null };
    if (l.phase === "antworten") return { text: l.offen.von === ich ? "Und …?" : `${er(l.offen.von)} hat geraten …`, sitz: l.offen.von };
    const nr = l.versuche[l.dran].length + 1;
    // Der allererste Versuch: wer beginnt.
    if (!l.versuche.a.length && !l.versuche.b.length) {
      if (l.dran === ich) return { text: "Du beginnst – wähle vier Farben und rate", sitz: ich };
      return { text: modus === "computer" ? "Der Computer beginnt" : `${name(l.dran)} ist dran`, sitz: l.dran };
    }
    if (l.dran === ich) {
      const knacktErster = l.geknackt[anderer(ich)];
      if (knacktErster) return { text: `${er(anderer(ich))} hat geknackt! Schaffst du es auch? Versuch ${nr} von ${VERSUCHE}`, sitz: ich };
      return { text: `Du rätst – Versuch ${nr} von ${VERSUCHE}`, sitz: ich };
    }
    return { text: `${er(l.dran)} rät – Versuch ${nr} von ${VERSUCHE}`, sitz: l.dran };
  }

  // --- Das Bild -------------------------------------------------------------------
  const stift = (farbe, klasse = "") => el("span", `zw-fc-stift${farbe ? ` ist-f${farbe}` : " ist-leer"} ${klasse}`.trim());

  function held() {
    const bild = el("div", "zw-fc-held");
    [["2244", [2, 0]], ["5216", [2, 1]], ["5264", [4, 0]]].forEach(([code, [p, d]]) => {
      const zeile = el("div", "zw-fc-held-zeile");
      [...code].forEach((f) => zeile.append(stift(f)));
      const ant = el("span", "zw-fc-antwort");
      for (let i = 0; i < PLAETZE; i += 1) ant.append(el("span", `zw-fc-punkt${i < p ? " ist-platz" : i < p + d ? " ist-da" : ""}`));
      zeile.append(ant);
      bild.append(zeile);
    });
    return bild;
  }

  function brett({ zug, ton, knopf }) {
    const knoten = el("div", "zw-fc");
    // Oben: meine Versuche auf den Code des anderen. Unten: sein Raten auf
    // meinen Code (klein), mit meinem Code daneben.
    const angriff = el("section", "zw-fc-tafel ist-angriff");
    const angriffKopf = el("div", "zw-fc-kopf");
    const angriffZeilen = el("div", "zw-fc-zeilen");
    angriff.append(angriffKopf, angriffZeilen);
    const abwehr = el("section", "zw-fc-tafel ist-abwehr");
    const abwehrKopf = el("div", "zw-fc-kopf");
    const abwehrZeilen = el("div", "zw-fc-zeilen");
    abwehr.append(abwehrKopf, abwehrZeilen);
    // Die Eingabe: vier Plätze, sechs Farben, «Fertig!» oder «Raten». Erst
    // eine Farbe wählen (sie bleibt in der Hand), dann den Platz antippen.
    const eingabe = el("div", "zw-fc-eingabe");
    const plaetze = el("div", "zw-fc-plaetze");
    const platzKnoepfe = [];
    for (let i = 0; i < PLAETZE; i += 1) {
      const p = el("button", "zw-fc-platz");
      p.type = "button";
      p.dataset.platz = String(i);
      p.addEventListener("click", () => platz(i));
      platzKnoepfe.push(p);
      plaetze.append(p);
    }
    const hinweis = el("div", "zw-fc-hinweis");
    hinweis.setAttribute("aria-live", "polite");
    const palette = el("div", "zw-fc-palette");
    const farbKnoepfe = [];
    for (let f = 1; f <= FARBEN; f += 1) {
      const k = el("button", `zw-fc-farbe ist-f${f}`);
      k.type = "button";
      k.dataset.farbe = String(f);
      k.setAttribute("aria-label", FARB_NAMEN[f - 1]);
      k.addEventListener("click", () => farbe(String(f)));
      farbKnoepfe.push(k);
      palette.append(k);
    }
    const los = knopf("Raten", "mini-knopf mini-knopf-voll vr-los zw-fc-los", () => absenden());
    eingabe.append(plaetze, hinweis, palette, los);
    const tafeln = el("div", "zw-fc-tafeln");
    tafeln.append(angriff, abwehr);
    knoten.append(tafeln, eingabe);

    let jetzt = null;
    let wahlCode = ["", "", "", ""];
    let hand = "";
    let partie = null;
    let gesehen = -1;

    const verstecken = (b) => Boolean(b && b.ich && !b.aus && b.lage.phase === "verstecken" && !b.lage.bereit[b.ich]);
    const raten = (b) => Boolean(b && b.ich && !b.aus && b.lage.phase === "raten" && b.lage.dran === b.ich);

    // Eine Farbe in die Hand nehmen – oder, nochmals angetippt, wieder weglegen.
    function farbe(f) {
      if (!verstecken(jetzt) && !raten(jetzt)) return;
      hand = hand === f ? "" : f;
      ton("tipp");
      zeichne(jetzt);
    }

    // Ein Platz: mit Farbe in der Hand bekommt er diese, sonst wird er leer.
    function platz(i) {
      if (!verstecken(jetzt) && !raten(jetzt)) return;
      wahlCode[i] = hand;
      ton("tipp");
      zeichne(jetzt);
    }

    function absenden() {
      const code = wahlCode.join("");
      if (!gueltig(code)) return;
      const b = jetzt;
      if (verstecken(b)) {
        codeMerken(b.raum, b.nr, b.ich, code);
        zug(`C${b.ich}`);
      } else if (raten(b)) zug(`R${code}`);
      else return;
      wahlCode = ["", "", "", ""];
      hand = "";
    }

    function zeile(versuch, platz, da, neu) {
      const z = el("div", `zw-fc-zeile${neu ? " ist-neu" : ""}`);
      [...versuch].forEach((f) => z.append(stift(f)));
      const ant = el("span", "zw-fc-antwort");
      ant.setAttribute("aria-label", `${platz} am richtigen Platz, ${da} anderswo`);
      for (let i = 0; i < PLAETZE; i += 1) ant.append(el("span", `zw-fc-punkt${i < platz ? " ist-platz" : i < platz + da ? " ist-da" : ""}`));
      z.append(ant);
      return z;
    }

    function zeichne(b) {
      if (!b) return;
      jetzt = b;
      const l = b.lage;
      const ich = b.ich || "a";
      const gegen = anderer(ich);
      const namen = b.namen || { a: "", b: "" };
      if (partie !== `${b.raum}|${b.nr}`) { partie = `${b.raum}|${b.nr}`; wahlCode = ["", "", "", ""]; hand = ""; gesehen = -1; }

      // Tafel oben: mein Raten auf den Code des anderen.
      angriffKopf.innerHTML = "";
      angriffKopf.append(el("span", "zw-fc-titel", !b.ich ? `${namen.a} rät` : b.modus === "computer" ? "Code des Computers" : `Code von ${namen[gegen] || "drüben"}`));
      const geheim = el("span", "zw-fc-geheim");
      const gezeigt = l.gezeigt[gegen] || (l.geknackt[ich] ? l.versuche[ich][l.geknackt[ich] - 1]?.versuch : "");
      for (let i = 0; i < PLAETZE; i += 1) geheim.append(gezeigt ? stift(gezeigt[i]) : el("span", "zw-fc-stift ist-geheim", "?"));
      angriffKopf.append(geheim);
      angriffZeilen.innerHTML = "";
      const meine = l.versuche[ich];
      meine.forEach((v, i) => angriffZeilen.append(zeile(v.versuch, v.platz, v.da, i === meine.length - 1 && l.versuche[ich].length > gesehen && gesehen >= 0)));
      if (l.offen?.von === ich) {
        const warte = el("div", "zw-fc-zeile ist-unterwegs");
        [...l.offen.versuch].forEach((f) => warte.append(stift(f)));
        warte.append(el("span", "zw-fc-antwort ist-warten", "…"));
        angriffZeilen.append(warte);
      }
      const frei = VERSUCHE - meine.length - (l.offen?.von === ich ? 1 : 0);
      for (let i = 0; i < Math.max(0, frei); i += 1) angriffZeilen.append(el("div", "zw-fc-zeile ist-frei"));

      // Tafel unten: das Raten des anderen auf meinen Code.
      abwehrKopf.innerHTML = "";
      abwehrKopf.append(el("span", "zw-fc-titel", b.ich ? "Dein Code" : `${namen.b} rät`));
      const mein = b.ich && (l.phase !== "verstecken" || l.bereit[ich]) ? (codesLesen()[schluessel(b.raum, b.nr, ich)]?.c || l.gezeigt[ich] || "") : "";
      const meinKnoten = el("span", "zw-fc-geheim");
      for (let i = 0; i < PLAETZE; i += 1) meinKnoten.append(mein ? stift(mein[i]) : el("span", "zw-fc-stift ist-geheim", "?"));
      abwehrKopf.append(meinKnoten);
      abwehrZeilen.innerHTML = "";
      l.versuche[gegen].forEach((v) => abwehrZeilen.append(zeile(v.versuch, v.platz, v.da, false)));
      if (l.offen?.von === gegen) {
        const warte = el("div", "zw-fc-zeile ist-unterwegs");
        [...l.offen.versuch].forEach((f) => warte.append(stift(f)));
        warte.append(el("span", "zw-fc-antwort ist-warten", "…"));
        abwehrZeilen.append(warte);
      }

      // Die Eingabe.
      const zeigeEingabe = verstecken(b) || raten(b);
      eingabe.hidden = !zeigeEingabe;
      tafeln.hidden = l.phase === "verstecken";
      if (!zeigeEingabe) hand = "";
      plaetze.className = `zw-fc-plaetze${hand ? ` ist-bereit ist-f${hand}` : ""}`;
      platzKnoepfe.forEach((p, i) => {
        p.className = `zw-fc-platz${wahlCode[i] ? ` ist-f${wahlCode[i]}` : ""}`;
        const jetztDa = wahlCode[i] ? FARB_NAMEN[Number(wahlCode[i]) - 1] : "leer";
        p.setAttribute("aria-label", `Platz ${i + 1}: ${jetztDa}${hand ? ` – antippen für ${FARB_NAMEN[Number(hand) - 1]}` : ""}`);
      });
      farbKnoepfe.forEach((k) => {
        k.classList.toggle("ist-gewaehlt", k.dataset.farbe === hand);
        k.setAttribute("aria-pressed", String(k.dataset.farbe === hand));
      });
      const voll = gueltig(wahlCode.join(""));
      hinweis.textContent = hand ? `${FARB_NAMEN[Number(hand) - 1]} – jetzt einen Platz antippen` : voll ? "" : "Tippe eine Farbe an, dann einen Platz";
      los.textContent = verstecken(b) ? "Fertig!" : "Raten";
      los.disabled = !voll;

      // Ein Ton für jede neue Antwort.
      const alle = l.versuche.a.length + l.versuche.b.length;
      if (gesehen >= 0 && alle > gesehen) ton(l.geknackt.a || l.geknackt.b ? "treffer" : "klack");
      gesehen = alle;
      knoten.classList.toggle("ist-dran", raten(b) || verstecken(b));
      knoten.dataset.phase = l.phase;
    }

    return {
      knoten,
      zeichne,
      fokus: () => farbKnoepfe[0]?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "farbcode",
    titel: "Farbcode knacken",
    seite: "farbcode",
    unter: "Versteck einen Code aus vier Farben – auch doppelt – und knack den des anderen. Grün heisst: richtige Farbe am richtigen Platz, gelb: richtige Farbe, falscher Platz.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Rät oft drauflos" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Rät wie ein Codeknacker" },
    },
    texte: { start: "wähle vier Farben", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    auto,
    satz,
    neuePartie: () => ({ saat: Math.floor(Math.random() * 4294967295) }),
    fuerPruefung: { antwort, ALLE, gueltig },
  });
})();
