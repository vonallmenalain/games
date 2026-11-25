/*
 * rechnen.js – Rechenduell: Wer rechnet schneller? Ein Seil zeigt es.
 * ---------------------------------------------------------------------------
 * Die Seite /rechnen. Beide rechnen gleichzeitig, jede ihre eigenen Aufgaben
 * – und jede auf ihrer eigenen Stufe: Die Kleine rechnet «bis 10», die
 * Grosse das Einmaleins. So ist das Duell auch zwischen Geschwistern fair.
 * Zu jeder Aufgabe stehen vier Antworten da. Richtig zieht das Seil einen
 * Schritt zu sich; falsch streicht die Antwort durch, und man probiert
 * nochmal. Wer das Seil fünf Schritte zu sich gezogen hat, gewinnt.
 *
 * Die Aufgaben kommen aus der Saat der Partie, dem Platz (a oder b), der
 * Nummer der Aufgabe und der Stufe – so rechnet jedes Gerät nach, ob eine
 * Antwort stimmt. Die Stufe wählt jede auf ihrem Gerät (sie bleibt dort
 * gemerkt, rechnen.stufe) und kann sie jederzeit wechseln; sie steht in
 * jedem Zug. Ein Zug ist «a7:2:1» – wer, die wievielte Aufgabe, Stufe,
 * welche der vier Antworten.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen die Aufgaben, die Regeln und der Computer.
 *
 * Der Computer rechnet mit, so schnell wie seine Stufe:
 *
 *   leicht    gut fünf Sekunden je Aufgabe, jede vierte falsch
 *   einfach   gut vier Sekunden, selten falsch
 *   mittel    gut drei Sekunden
 *   schwer    gut zwei Sekunden, fast nie falsch
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "rechnen") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const ZIEL = 5;
  const STUFEN = [
    { name: "Bis 10", kurz: "bis 10" },
    { name: "Bis 20", kurz: "bis 20" },
    { name: "Bis 100", kurz: "bis 100" },
    { name: "Einmaleins", kurz: "1 × 1" },
    { name: "Alles", kurz: "alles" },
  ];
  const STUFE_KEY = "rechnen.stufe";

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

  // Eine Aufgabe: Text, Ergebnis, vier Antworten (eine richtig, drei nahe
  // daneben, nie negativ), gemischt.
  function aufgabe(saat, sitz, nr, stufe) {
    const rnd = wuerfel(((Number(saat) >>> 0) ^ Math.imul(nr + 1, 0x9e3779b1) ^ (sitz === "b" ? 0x5bd1e995 : 0x27d4eb2f) ^ Math.imul(stufe + 3, 0x85ebca6b)) >>> 0);
    const zahl = (von, bis) => von + Math.floor(rnd() * (bis - von + 1));
    let text;
    let ergebnis;
    const art = stufe === 4 ? Math.floor(rnd() * 4) : stufe;
    if (art === 0) {
      if (rnd() < 0.6) { const x = zahl(0, 9); const y = zahl(1, 10 - x); text = `${x} + ${y}`; ergebnis = x + y; } else { const x = zahl(2, 10); const y = zahl(1, x); text = `${x} − ${y}`; ergebnis = x - y; }
    } else if (art === 1) {
      if (rnd() < 0.55) { const x = zahl(3, 15); const y = zahl(2, 20 - x); text = `${x} + ${y}`; ergebnis = x + y; } else { const x = zahl(8, 20); const y = zahl(2, Math.min(9, x)); text = `${x} − ${y}`; ergebnis = x - y; }
    } else if (art === 2) {
      const r = rnd();
      if (r < 0.4) { const x = zahl(12, 89); const y = zahl(2, Math.min(9, 99 - x)); text = `${x} + ${y}`; ergebnis = x + y; }
      else if (r < 0.7) { const x = zahl(1, 8) * 10; const y = zahl(1, (9 - x / 10)) * 10; text = `${x} + ${y}`; ergebnis = x + y; }
      else { const x = zahl(20, 99); const y = zahl(2, 9); text = `${x} − ${y}`; ergebnis = x - y; }
    } else if (art === 3 || rnd() < 0.5) {
      const x = zahl(2, 10); const y = zahl(1, 10); text = `${x} × ${y}`; ergebnis = x * y;
    } else {
      const x = zahl(2, 10); const y = zahl(1, 10); text = `${x * y} : ${x}`; ergebnis = y;
    }
    const nah = ergebnis >= 20 ? [1, 2, 10, -1, -2, -10, 3] : [1, 2, -1, -2, 3, -3];
    const wahl = [ergebnis];
    for (let i = 0; wahl.length < 4 && i < 40; i += 1) {
      const d = nah[Math.floor(rnd() * nah.length)] * (i > 20 ? 2 : 1);
      const w = ergebnis + d;
      if (w >= 0 && !wahl.includes(w)) wahl.push(w);
    }
    for (let i = wahl.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [wahl[i], wahl[j]] = [wahl[j], wahl[i]]; }
    return { text, ergebnis, wahl, richtig: wahl.indexOf(ergebnis) };
  }

  // --- Die Regeln -----------------------------------------------------------------
  const MUSTER = /^([ab])(\d{1,3}):([0-4]):([0-3])$/;

  function lage(zuege, { saat }) {
    const nr = { a: 0, b: 0 };
    const richtig = { a: 0, b: 0 };
    const stufe = { a: null, b: null };
    // Was bei der laufenden Aufgabe schon falsch war: { stufe, wahl: [] }.
    const falsch = { a: { stufe: -1, wahl: [] }, b: { stufe: -1, wahl: [] } };
    let seil = 0; // > 0: zu a hin, < 0: zu b hin
    let ende = null;
    let letzter = null;
    for (const z of zuege) {
      const m = MUSTER.exec(z);
      const wer = m?.[1];
      if (!m || ende || Number(m[2]) !== nr[wer]) return { nr, richtig, stufe, falsch, seil, ende, letzter, dran: null, kaputt: true };
      const st = Number(m[3]);
      const k = Number(m[4]);
      const auf = aufgabe(saat, wer, nr[wer], st);
      if (falsch[wer].stufe === st && falsch[wer].wahl.includes(k)) return { nr, richtig, stufe, falsch, seil, ende, letzter, dran: null, kaputt: true };
      stufe[wer] = st;
      if (k === auf.richtig) {
        richtig[wer] += 1;
        nr[wer] += 1;
        falsch[wer] = { stufe: -1, wahl: [] };
        seil += wer === "a" ? 1 : -1;
        letzter = { wer, richtig: true };
        if (Math.abs(seil) >= ZIEL) ende = seil > 0 ? "a" : "b";
      } else {
        falsch[wer] = { stufe: st, wahl: falsch[wer].stufe === st ? [...falsch[wer].wahl, k] : [k] };
        letzter = { wer, richtig: false };
      }
    }
    return { nr, richtig, stufe, falsch, seil, ende, letzter, dran: ende ? null : "beide" };
  }

  function darf(l, zug, sitz) {
    const m = MUSTER.exec(zug);
    if (!m || l.ende || m[1] !== sitz || Number(m[2]) !== l.nr[sitz]) return false;
    const st = Number(m[3]);
    return !(l.falsch[sitz].stufe === st && l.falsch[sitz].wahl.includes(Number(m[4])));
  }

  // --- Der Computer -------------------------------------------------------------
  // [Zeit je Aufgabe (ms), Streuung, wie oft falsch]
  const TEMPO = { leicht: [5400, 1400, 0.25], einfach: [4300, 1100, 0.12], mittel: [3300, 800, 0.08], schwer: [2300, 500, 0.04] };
  // Wann der Computer mit seiner Aufgabe fertig ist – gemerkt, denn der
  // Rahmen fragt nach jedem Zug neu (auch nach denen der anderen).
  let uhr = { schluessel: "", fertig: 0, falsch: false };

  function computer(l, sitz, stufe, { saat } = {}) {
    if (l.ende) return null;
    const [zeit, streu, fehler] = TEMPO[stufe] || TEMPO.mittel;
    const st = 0;
    const auf = aufgabe(saat, sitz, l.nr[sitz], st);
    const schluessel = `${saat}|${l.nr[sitz]}|${l.falsch[sitz].wahl.length}`;
    if (uhr.schluessel !== schluessel) {
      uhr = { schluessel, fertig: Date.now() + Math.max(900, zeit + (Math.random() * 2 - 1) * streu) * (l.falsch[sitz].wahl.length ? 0.4 : 1), falsch: Math.random() < fehler };
    }
    const schon = l.falsch[sitz].stufe === st ? l.falsch[sitz].wahl : [];
    const daneben = [0, 1, 2, 3].filter((k) => k !== auf.richtig && !schon.includes(k));
    const k = uhr.falsch && daneben.length ? daneben[Math.floor(Math.random() * daneben.length)] : auf.richtig;
    return { zug: `${sitz}${l.nr[sitz]}:${st}:${k}`, warte: Math.max(0, uhr.fertig - Date.now()) };
  }

  // --- Was über dem Seil steht ------------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende || !ich) return null;
    const er = (sitz) => (modus === "computer" ? "Der Computer" : name(sitz));
    const vorne = l.seil === 0 ? null : (l.seil > 0 ? "a" : "b");
    const z = l.letzter;
    if (!z) return { text: "Los! Rechne so schnell du kannst!", sitz: null };
    if (z.wer === ich && !z.richtig) return { text: "Nicht ganz – nochmal!", sitz: ich };
    if (!vorne) return { text: "Gleichstand – weiter!", sitz: null };
    const abstand = Math.abs(l.seil);
    if (vorne === ich) return { text: abstand >= ZIEL - 1 ? "Noch eine – dann hast du gewonnen!" : `Du ziehst! Noch ${ZIEL - abstand} Schritte.`, sitz: ich };
    return { text: abstand >= ZIEL - 1 ? `${er(vorne)} braucht nur noch eine – schnell!` : `${er(vorne)} zieht – schneller!`, sitz: vorne };
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-rd-held");
    bild.append(el("span", "zw-rd-held-seil"), el("span", "zw-rd-held-knoten"),
      el("span", "zw-rd-held-kind ist-a", "\u{1F9D2}"), el("span", "zw-rd-held-kind ist-b", "\u{1F467}"),
      el("span", "zw-rd-held-aufgabe", "7 + 5"));
    return bild;
  }

  function gemerkteStufe() {
    try { const s = Number(localStorage.getItem(STUFE_KEY)); return Number.isInteger(s) && s >= 0 && s < STUFEN.length ? s : 0; } catch { return 0; }
  }

  function brett({ zug, ton, ruhig }) {
    const knoten = el("div", "vr-feld zw-rd");
    knoten.dataset.zuege = "0";
    // Oben das Seil: links ich, rechts die andere. Der Knoten wandert.
    const bahn = el("div", "zw-rd-bahn");
    const links = el("div", "zw-rd-seite ist-links");
    const rechts = el("div", "zw-rd-seite ist-rechts");
    const seil = el("div", "zw-rd-seil");
    const knot = el("span", "zw-rd-knoten");
    seil.append(knot);
    for (let i = -ZIEL; i <= ZIEL; i += 1) {
      const m = el("span", `zw-rd-marke${i === 0 ? " ist-mitte" : Math.abs(i) === ZIEL ? " ist-ziel" : ""}`);
      m.style.left = `${50 + (i / ZIEL) * 46}%`;
      seil.append(m);
    }
    bahn.append(links, seil, rechts);

    const karte = el("div", "zw-rd-karte");
    const aufgabeText = el("div", "zw-rd-aufgabe");
    aufgabeText.setAttribute("aria-live", "polite");
    const wahl = el("div", "zw-rd-wahlen");
    const knoepfe = [0, 1, 2, 3].map((k) => {
      const b = el("button", "zw-rd-wahl");
      b.type = "button";
      b.dataset.wahl = String(k);
      b.addEventListener("click", () => antworten(k));
      wahl.append(b);
      return b;
    });
    karte.append(aufgabeText, wahl);

    const stufenLeiste = el("div", "zw-rd-stufen");
    stufenLeiste.setAttribute("role", "group");
    stufenLeiste.setAttribute("aria-label", "Deine Stufe");
    stufenLeiste.append(el("span", "zw-rd-stufen-titel", "Deine Aufgaben:"));
    const stufenKnoepfe = STUFEN.map((s, i) => {
      const b = el("button", "zw-rd-stufe", s.name);
      b.type = "button";
      b.dataset.stufe = String(i);
      b.addEventListener("click", () => {
        meineStufe = i;
        try { localStorage.setItem(STUFE_KEY, String(i)); } catch { /* dann nur jetzt */ }
        ton("tipp");
        zeichneAufgabe();
      });
      stufenLeiste.append(b);
      return b;
    });
    knoten.append(bahn, karte, stufenLeiste);

    let meineStufe = gemerkteStufe();
    let letzte = null;
    let gesperrtBis = 0;
    let gezeigt = { nr: -1, zahl: -1 };

    function antworten(k) {
      if (!letzte || Date.now() < gesperrtBis) return;
      const b = knoepfe[k];
      if (b.disabled) return;
      zug(b.dataset.zug);
    }

    function zeichneAufgabe() {
      if (!letzte) return;
      const { lage: l, saat, ich, aus } = letzte;
      const sicht = ich || "a";
      const auf = aufgabe(saat, sicht, l.nr[sicht], meineStufe);
      const schon = l.falsch[sicht].stufe === meineStufe ? l.falsch[sicht].wahl : [];
      const kann = Boolean(!aus && ich && !l.ende);
      aufgabeText.textContent = `${auf.text} = ?`;
      knoepfe.forEach((b, k) => {
        b.textContent = String(auf.wahl[k]);
        b.dataset.zug = `${sicht}${l.nr[sicht]}:${meineStufe}:${k}`;
        b.classList.toggle("ist-falsch", schon.includes(k));
        b.disabled = !kann || schon.includes(k) || Date.now() < gesperrtBis;
      });
      stufenKnoepfe.forEach((b, i) => {
        b.classList.toggle("ist-an", i === meineStufe);
        b.setAttribute("aria-pressed", String(i === meineStufe));
        b.disabled = !kann && !l.ende ? false : false;
      });
      knoten.classList.toggle("ist-dran", kann);
    }

    function zeichne(args) {
      const { lage: l, nr, ich, namen, modus } = args;
      letzte = args;
      const sicht = ich || "a";
      const andere = anderer(sicht);
      const neu = nr === gezeigt.nr && l.letzter && (l.richtig.a + l.richtig.b + l.falsch.a.wahl.length + l.falsch.b.wahl.length) !== gezeigt.zahl;
      if (nr !== gezeigt.nr) gesperrtBis = 0;
      // Das Seil: von mir aus gesehen – zu mir hin ist links.
      const zuMir = sicht === "a" ? l.seil : -l.seil;
      knot.style.left = `${50 - (zuMir / ZIEL) * 46}%`;
      knoten.style.setProperty("--zug", String(zuMir));
      const name = (s) => (modus === "computer" && s === "b" ? "Computer" : namen?.[s] || s);
      links.innerHTML = "";
      rechts.innerHTML = "";
      links.append(el("span", `zw-rd-kind ist-${sicht}`, "\u{1F9D2}"), el("span", "zw-rd-name", "Du"));
      const st = l.stufe[andere];
      rechts.append(el("span", "zw-rd-name", `${name(andere)}${st !== null && st !== undefined ? ` · ${STUFEN[st].kurz}` : ""}`), el("span", `zw-rd-kind ist-${andere}`, modus === "computer" ? "\u{1F916}" : "\u{1F467}"));
      links.classList.toggle("ist-a", sicht === "a");
      links.classList.toggle("ist-b", sicht === "b");
      rechts.classList.toggle("ist-a", andere === "a");
      rechts.classList.toggle("ist-b", andere === "b");
      if (neu) {
        const z = l.letzter;
        if (z.wer === sicht && !z.richtig) {
          // Falsch: kurz warten, dann nochmal – raten lohnt sich nicht.
          gesperrtBis = Date.now() + (ruhig() ? 400 : 1100);
          window.setTimeout(() => zeichneAufgabe(), (ruhig() ? 400 : 1100) + 20);
          ton("platsch");
          karte.classList.remove("ist-wackel");
          void karte.offsetWidth;
          karte.classList.add("ist-wackel");
        } else if (z.richtig) {
          ton(z.wer === sicht ? "treffer" : "tipp");
          if (z.wer === sicht) { karte.classList.remove("ist-richtig"); void karte.offsetWidth; karte.classList.add("ist-richtig"); }
        }
      }
      gezeigt = { nr, zahl: l.richtig.a + l.richtig.b + l.falsch.a.wahl.length + l.falsch.b.wahl.length };
      knoten.dataset.zuege = String(l.richtig.a + l.richtig.b);
      knoten.classList.toggle("ist-aus", Boolean(l.ende));
      knoten.classList.toggle("ist-sieg-ich", l.ende === sicht);
      knoten.classList.toggle("ist-sieg-andere", Boolean(l.ende && l.ende !== sicht));
      zeichneAufgabe();
    }

    return {
      knoten,
      zeichne,
      fokus: () => (knoepfe.find((b) => !b.disabled) || knoepfe[0]).focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "rechnen",
    titel: "Rechenduell",
    seite: "rechnen",
    unter: "Beide rechnen gleichzeitig – jede auf ihrer Stufe, von «bis 10» bis zum Einmaleins. Jede richtige Antwort zieht das Seil zu dir. Wer es fünf Schritte zu sich zieht, gewinnt.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Rechnet gemütlich" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Ganz schön flott" },
      schwer: { name: "Schwer", sterne: 3, satz: "Blitzschnell" },
    },
    texte: { start: "rechne!", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    satz,
    vorlesen: (b) => {
      const l = b.lage;
      const ich = b.ich || "a";
      const zuMir = ich === "a" ? l.seil : -l.seil;
      return zuMir === 0 ? "Das Seil ist in der Mitte." : zuMir > 0 ? `Das Seil ist ${zuMir} ${zuMir === 1 ? "Schritt" : "Schritte"} bei dir.` : `Das Seil ist ${-zuMir} ${zuMir === -1 ? "Schritt" : "Schritte"} bei der anderen Seite.`;
    },
    fuerPruefung: { aufgabe, ZIEL, STUFEN },
  });
})();
