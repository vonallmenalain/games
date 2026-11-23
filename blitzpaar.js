/*
 * blitzpaar.js – Blitzpaar: Wer findet zuerst das doppelte Bild?
 * ---------------------------------------------------------------------------
 * Die Seite /blitzpaar. Beide spielen gleichzeitig. In jeder Runde liegen
 * zwölf Bilder da, genau eines davon zweimal. Wer zuerst auf eines der
 * beiden tippt, holt den Punkt. Wer daneben tippt, setzt den Rest der Runde
 * aus; tippen beide daneben, zählt die Runde nicht. Wer zuerst fünf Punkte
 * hat, gewinnt.
 *
 * Menü, Computer als Gegner, Duell, Turnier und Bilanz macht der Rahmen
 * (zwei.js). Hier stehen die Runden, die Regeln und der Computer.
 *
 * Welche Bilder wo liegen, kommt aus der Saat der Partie und der Nummer der
 * Runde – beide Geräte sehen dasselbe. Wer zuerst war, entscheidet die
 * Datenbank: Ein Tipp ist eine Transaktion, und nur der erste passende zählt.
 * Ein Zug ist «a3:7» – wer (a oder b), in welcher Runde, auf welches Bild.
 *
 * Der Computer braucht eine Weile zum Hinschauen und tippt manchmal daneben:
 *
 *   leicht    lässt sich gut vier Sekunden Zeit, tippt oft daneben
 *   einfach   etwa drei Sekunden
 *   mittel    gut zwei Sekunden, selten daneben
 *   schwer    gut eine Sekunde, fast nie daneben
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "blitzpaar") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  const BILDER = ["🍎", "🍌", "🍇", "🍓", "🍒", "🍉", "🍍", "🥕", "🌽", "🍄", "🌻", "🌈", "⭐", "🌙", "🌞", "⚽", "🏀", "🎈", "🎁", "🚗", "🚀", "🚲", "⛵", "🐟", "🐢", "🐞", "🦋", "🐝", "🐙", "🦀"];
  const FELDER = 12;
  const ZIEL = 5;
  const PAUSE = 1300; // so lange bleibt eine entschiedene Runde stehen

  // Eine Runde: zwölf Bilder, eines doppelt – aus Saat und Rundennummer.
  function runde(saat, nr) {
    let t = ((Number(saat) >>> 0) ^ Math.imul(nr + 1, 0x9e3779b1)) >>> 0 || 1;
    const rnd = () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let x = t;
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const vorrat = BILDER.map((_, i) => i);
    for (let i = vorrat.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [vorrat[i], vorrat[j]] = [vorrat[j], vorrat[i]];
    }
    const bilder = vorrat.slice(0, FELDER - 1);
    bilder.push(bilder[Math.floor(rnd() * bilder.length)]);
    for (let i = bilder.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      [bilder[i], bilder[j]] = [bilder[j], bilder[i]];
    }
    const doppelt = bilder.find((b, i) => bilder.indexOf(b) !== i);
    const paar = bilder.map((b, i) => (b === doppelt ? i : -1)).filter((i) => i >= 0);
    return { bilder, paar };
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { saat }) {
    const punkte = { a: 0, b: 0 };
    let nr = 0;
    let gesperrt = { a: -1, b: -1 }; // auf welches Bild daneben getippt
    const verlauf = []; // je entschiedene Runde: { nr, sieger, feld, daneben }
    let ende = null;
    for (const z of zuege) {
      const m = /^([ab])(\d{1,3}):(\d{1,2})$/.exec(z);
      if (!m || ende || Number(m[2]) !== nr || Number(m[3]) >= FELDER || gesperrt[m[1]] >= 0) {
        return { punkte, nr, gesperrt, verlauf, runde: runde(saat, nr), dran: null, ende, kaputt: true };
      }
      const wer = m[1];
      const feld = Number(m[3]);
      const r = runde(saat, nr);
      if (r.paar.includes(feld)) {
        punkte[wer] += 1;
        verlauf.push({ nr, sieger: wer, feld, daneben: { ...gesperrt } });
        nr += 1;
        gesperrt = { a: -1, b: -1 };
        if (punkte[wer] >= ZIEL) ende = wer;
      } else {
        gesperrt[wer] = feld;
        if (gesperrt.a >= 0 && gesperrt.b >= 0) {
          verlauf.push({ nr, sieger: null, feld: -1, daneben: { ...gesperrt } });
          nr += 1;
          gesperrt = { a: -1, b: -1 };
        }
      }
    }
    return { punkte, nr, gesperrt, verlauf, runde: runde(saat, nr), dran: ende ? null : "beide", ende, letzte: verlauf[verlauf.length - 1] || null };
  }

  function darf(l, zug, sitz) {
    const m = /^([ab])(\d{1,3}):(\d{1,2})$/.exec(zug);
    return Boolean(m) && !l.ende && m[1] === sitz && Number(m[2]) === l.nr && Number(m[3]) < FELDER && l.gesperrt[sitz] < 0;
  }

  // --- Der Computer -------------------------------------------------------------
  // [Zeit zum Finden (ms), Streuung, wie oft daneben]
  const TEMPO = { leicht: [6000, 2500, 0.18], einfach: [3800, 1500, 0.12], mittel: [2650, 1000, 0.07], schwer: [1600, 450, 0.03] };

  function computer(l, sitz, stufe) {
    if (l.ende || l.gesperrt[sitz] >= 0) return null;
    const [zeit, streu, daneben] = TEMPO[stufe] || TEMPO.mittel;
    // Nach einer entschiedenen Runde erst hinschauen, wenn die neue da ist.
    const warte = Math.max(500, zeit + (Math.random() * 2 - 1) * streu) + (l.letzte ? PAUSE : 300);
    const { paar } = l.runde;
    const falsch = [...Array(FELDER).keys()].filter((i) => !paar.includes(i));
    const feld = Math.random() < daneben ? falsch[Math.floor(Math.random() * falsch.length)] : paar[Math.floor(Math.random() * 2)];
    return { zug: `${sitz}${l.nr}:${feld}`, warte };
  }

  // --- Was über den Bildern steht ---------------------------------------------------
  function satz(l, { ich, name, modus }) {
    const er = (sitz) => (sitz === ich ? "Du" : modus === "computer" ? "Der Computer" : name(sitz));
    if (l.ende) return null;
    if (ich && l.gesperrt[ich] >= 0) return { text: "Daneben! Warte auf die nächste Runde.", sitz: ich };
    const z = l.letzte;
    if (z && z.nr === l.nr - 1) {
      if (!z.sieger) return { text: "Beide daneben – nächste Runde!", sitz: null };
      return { text: z.sieger === ich ? "Punkt für dich! Schnell, die nächste …" : `Punkt für ${er(z.sieger) === "Der Computer" ? "den Computer" : er(z.sieger)}! Die nächste …`, sitz: z.sieger };
    }
    return { text: "Welches Bild ist doppelt? Schnell tippen!", sitz: null };
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-bp-held");
    ["🍎", "🚀", "🐢", "⭐", "🚀", "🌻"].forEach((b, i) => bild.append(el("span", `zw-bp-held-feld${b === "🚀" ? " ist-paar" : ""}`, b)));
    return bild;
  }

  function brett({ zug, ton, ruhig }) {
    const knoten = el("div", "zw-bp");
    const stand = el("div", "zw-bp-stand");
    const zahl = { a: el("span", "zw-bp-zahl ist-a"), b: el("span", "zw-bp-zahl ist-b") };
    const rundeText = el("span", "zw-bp-runde");
    stand.append(zahl.a, rundeText, zahl.b);
    const feld = el("div", "zw-bp-feld");
    feld.setAttribute("role", "group");
    feld.setAttribute("aria-label", "Die Bilder dieser Runde");
    const knoepfe = [];
    for (let i = 0; i < FELDER; i += 1) {
      const k = el("button", "zw-bp-bild");
      k.type = "button";
      k.dataset.feld = String(i);
      k.addEventListener("click", () => tippe(i));
      knoepfe.push(k);
      feld.append(k);
    }
    knoten.append(stand, feld);

    let jetzt = null;
    let gezeigt = -1;      // welche Runde zu sehen ist
    let frei = 0;          // ab wann wieder getippt werden darf
    let uhr = 0;
    let getippt = -1;      // was ich in dieser Runde schon geschickt habe

    function tippe(i) {
      const b = jetzt;
      if (!b || b.aus || !b.ich || Date.now() < frei || gezeigt !== b.lage.nr || getippt >= 0) return;
      if (b.lage.ende || b.lage.gesperrt[b.ich] >= 0) return;
      getippt = i;
      knoepfe[i].classList.add("ist-getippt");
      sperren();
      zug(`${b.ich}${b.lage.nr}:${i}`);
    }

    // Die Bilder einer Runde – mit Ergebnis, wenn sie entschieden ist.
    function malen(nr, ergebnis = null) {
      const l = jetzt.lage;
      const r = runde(jetzt.saat, nr);
      const daneben = ergebnis ? ergebnis.daneben : (nr === l.nr ? l.gesperrt : { a: -1, b: -1 });
      knoepfe.forEach((k, i) => {
        k.textContent = BILDER[r.bilder[i]];
        k.className = "zw-bp-bild";
        if (ergebnis && r.paar.includes(i)) k.classList.add("ist-paar");
        if (ergebnis?.sieger && ergebnis.feld === i) k.classList.add("ist-treffer", `ist-${ergebnis.sieger}`);
        if (daneben.a === i) k.classList.add("ist-daneben", "ist-a");
        if (daneben.b === i) k.classList.add("ist-daneben", "ist-b");
        if (!ergebnis && i === getippt) k.classList.add("ist-getippt");
        k.setAttribute("aria-label", `Bild ${i + 1}`);
      });
    }

    function sperren() {
      const b = jetzt;
      const l = b.lage;
      const aus = !b.ich || b.aus || Boolean(l.ende) || l.gesperrt[b.ich] >= 0 || Date.now() < frei || getippt >= 0;
      knoepfe.forEach((k) => { k.disabled = aus; });
      knoten.classList.toggle("ist-dran", !aus);
      knoten.classList.toggle("ist-pause", Date.now() < frei);
      knoten.classList.toggle("ist-gesperrt", Boolean(b.ich && l.gesperrt[b.ich] >= 0));
    }

    function zeichne(b) {
      if (!b) return;
      const neuePartie = !jetzt || jetzt.nr !== b.nr || jetzt.saat !== b.saat;
      const warGesperrt = jetzt && !neuePartie && jetzt.ich && jetzt.lage.gesperrt[jetzt.ich] >= 0;
      jetzt = b;
      const l = b.lage;
      if (neuePartie) { gezeigt = l.nr; frei = 0; getippt = -1; window.clearTimeout(uhr); }
      zahl.a.textContent = `${b.namen?.a || "a"}: ${l.punkte.a}`;
      zahl.b.textContent = `${b.namen?.b || "b"}: ${l.punkte.b}`;
      rundeText.textContent = l.ende ? "" : `Runde ${l.nr + 1}`;
      if (l.nr > gezeigt) {
        // Eine Runde ist entschieden: Sie bleibt kurz stehen – wer hat
        // getroffen, wer daneben. Dann kommt die nächste.
        const erg = l.verlauf[l.verlauf.length - 1];
        malen(erg.nr, erg);
        ton(erg.sieger && (erg.sieger === b.ich || !b.ich) ? "treffer" : "platsch");
        gezeigt = l.nr;
        getippt = -1;
        frei = Date.now() + (ruhig() ? 300 : PAUSE);
        window.clearTimeout(uhr);
        if (!l.ende) {
          uhr = window.setTimeout(() => {
            if (!jetzt) return;
            malen(jetzt.lage.nr);
            sperren();
          }, frei - Date.now() + 10);
        }
        sperren();
        return;
      }
      if (Date.now() >= frei) malen(l.nr);
      if (!warGesperrt && b.ich && l.gesperrt[b.ich] >= 0) ton("platsch");
      sperren();
    }

    return {
      knoten,
      zeichne,
      fokus: () => knoepfe[0]?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "blitzpaar",
    titel: "Blitzpaar",
    seite: "blitzpaar",
    unter: "Zwölf Bilder, eines ist doppelt. Wer es zuerst antippt, holt den Punkt – wer danebentippt, setzt aus. Fünf Punkte gewinnen.",
    held,
    trenner: ".",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Lässt sich viel Zeit" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Ganz schön flink" },
      schwer: { name: "Schwer", sterne: 3, satz: "Blitzschnell" },
    },
    texte: { start: "schnell!", remis: "Unentschieden." },
    lage,
    darf,
    brett,
    computer,
    satz,
    neuePartie: () => ({ saat: Math.floor(Math.random() * 4294967295) }),
  });
})();
