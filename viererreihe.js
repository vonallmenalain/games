/*
 * viererreihe.js – Vier in einer Reihe: gegen den Computer oder live zu zweit.
 * ---------------------------------------------------------------------------
 * Die Seite /viererreihe. Ein Brett mit sieben Spalten und sechs Reihen; wer
 * an der Reihe ist, lässt einen Stein in eine Spalte fallen. Wer zuerst vier
 * gleiche in einer Reihe hat – waagrecht, senkrecht oder schräg –, gewinnt.
 *
 * Alles, was die Spiele zu zweit teilen – Menü, Computer als Gegner, Duell,
 * Warteraum, Code, im Turnier «Mit Lena spielen», Bilanz, Töne –, steht in
 * zwei.js. Hier steht nur, was Viererreihe ausmacht: das Brett, hinter dessen
 * Platte die Steine fallen, die Regeln und der Computer (viererreihe-ki.js).
 *
 * Eine Partie steht als Text: die Spalten der Züge, der Reihe nach («3342…»,
 * ein Zeichen je Zug). Jedes Gerät baut daraus dasselbe Brett
 * (LernappVierer.ausZuegen) und kommt auf denselben Sieger.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "viererreihe") return;

  const V = window.LernappVierer;
  const Z = window.LernappZwei;
  const kids = () => window.LernappKids || null;
  if (!V || !Z) return;

  const el = Z.el;
  const ton = Z.ton;
  const anderer = Z.anderer;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // ---------------------------------------------------------------------------
  // Das Brett
  // ---------------------------------------------------------------------------
  /*
   * Hinten eine dunkle Rückwand, davor die Steine, ganz vorne die Platte mit
   * den Löchern (eine Maske, styles.css .vr-platte) – so fällt ein Stein
   * hinter der Platte hinunter, wie bei einem echten Brett. Darüber sieben
   * unsichtbare Knöpfe, je einer für eine ganze Spalte, und über dem Brett
   * eine Reihe Luft: Dort schwebt der Stein, der gleich fällt.
   *
   *   beiZug(spalte)   was ein Tipp auf eine Spalte tut
   *
   * zeichne({ zuege, beginnt, dran, ich }) bringt das Bild auf den Stand:
   * Kommt ein Zug dazu, fällt er; ist es eine neue Partie, fallen die alten
   * Steine unten hinaus.
   */
  function brettBauen({ beiZug }) {
    const feld = el("div", "vr-feld");
    const brett = el("div", "vr-brett");
    const steine = el("div", "vr-steine");
    const platte = el("div", "vr-platte");
    platte.setAttribute("aria-hidden", "true");
    const vorschau = el("span", "vr-stein vr-vorschau");
    vorschau.setAttribute("aria-hidden", "true");
    vorschau.hidden = true;
    const spalten = el("div", "vr-spalten");
    spalten.setAttribute("role", "group");
    spalten.setAttribute("aria-label", "Spalten des Bretts");
    brett.append(steine, platte);
    feld.append(vorschau, brett, spalten);

    const zustand = { zuege: null, beginnt: "a", nr: -1, knoten: [], dran: null, ich: null, aus: false };
    let zeiger = -1;

    const knoepfe = [];
    for (let c = 0; c < V.SPALTEN; c += 1) {
      const k = el("button", "vr-spalte");
      k.type = "button";
      k.dataset.spalte = String(c);
      k.addEventListener("click", () => beiZug(c));
      k.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") zeige(c); });
      k.addEventListener("focus", () => zeige(c));
      k.addEventListener("keydown", (e) => {
        let ziel = -1;
        if (e.key === "ArrowLeft") ziel = Math.max(0, c - 1);
        else if (e.key === "ArrowRight") ziel = Math.min(V.SPALTEN - 1, c + 1);
        else if (/^[1-7]$/.test(e.key)) { e.preventDefault(); beiZug(Number(e.key) - 1); return; }
        if (ziel < 0) return;
        e.preventDefault();
        knoepfe[ziel].focus();
      });
      knoepfe.push(k);
      spalten.append(k);
    }
    spalten.addEventListener("pointerleave", () => zeige(-1));

    function wessen(stein, beginnt) {
      return stein === 1 ? beginnt : anderer(beginnt);
    }

    // Der schwebende Stein über der Spalte: nur wenn ich dran bin.
    function zeige(c) {
      zeiger = c;
      const darf = !zustand.aus && zustand.dran && zustand.dran === zustand.ich && c >= 0;
      vorschau.hidden = !darf;
      if (!darf) return;
      vorschau.className = `vr-stein vr-vorschau ist-${zustand.ich}`;
      vorschau.style.setProperty("--c", String(c));
    }

    function steinKnoten(c, r, sitz) {
      const s = el("span", `vr-stein ist-${sitz}`);
      s.style.setProperty("--c", String(c));
      s.style.setProperty("--r", String(r));
      return s;
    }

    // Ein Stein fällt von über dem Brett bis in seine Reihe – und federt kurz.
    function fallen(knoten, r, { leise = false } = {}) {
      if (ruhig() || !knoten.animate) { if (!leise) ton("klack"); return; }
      const hoehe = V.REIHEN - r; // in Zellen, von der Reihe über dem Brett
      const dauer = 180 + Math.sqrt(hoehe) * 120;
      const flug = knoten.animate([
        { transform: `translateY(${-hoehe * 100}%)` },
        { transform: "translateY(0)" },
      ], { duration: dauer, easing: "cubic-bezier(0.55, 0, 1, 0.45)" });
      flug.onfinish = () => {
        if (!leise) ton("klack");
        knoten.animate([
          { transform: "translateY(0)" },
          { transform: "translateY(-14%)", offset: 0.45 },
          { transform: "translateY(0)" },
        ], { duration: 170, easing: "ease-out" });
      };
    }

    // Die Steine einer fertigen Partie fallen unten hinaus.
    function leeren() {
      const alte = [...steine.children];
      if (!alte.length) return;
      if (ruhig() || !alte[0].animate) { alte.forEach((s) => s.remove()); return; }
      alte.forEach((s) => {
        s.classList.remove("ist-sieg", "ist-letzter");
        const r = Number(s.style.getPropertyValue("--r")) || 0;
        const a = s.animate([
          { transform: "translateY(0)", opacity: 1 },
          { transform: `translateY(${(r + 2) * 100}%)`, opacity: 0 },
        ], { duration: 380 + Math.random() * 160, delay: Math.random() * 90, easing: "cubic-bezier(0.5, 0, 1, 0.5)", fill: "forwards" });
        a.onfinish = () => s.remove();
      });
    }

    function beschrifte() {
      knoepfe.forEach((k, c) => {
        const frei = zustand.lage ? V.REIHEN - zustand.lage.brett.h[c] : V.REIHEN;
        const darf = !zustand.aus && zustand.dran && zustand.dran === zustand.ich && frei > 0;
        k.disabled = !darf;
        k.setAttribute("aria-label", `Spalte ${c + 1}${frei ? `, noch ${frei} frei` : ", voll"}`);
      });
    }

    function zeichne({ roh: zuege, beginnt, nr, dran, ich, aus }) {
      const neuePartie = nr !== zustand.nr || beginnt !== zustand.beginnt
        || zustand.zuege === null || !zuege.startsWith(zustand.zuege);
      if (neuePartie) {
        const vorher = zustand.zuege;
        if (vorher !== null) leeren();
        else steine.innerHTML = "";
        zustand.zuege = "";
        zustand.knoten = [];
      }
      zustand.nr = nr;
      zustand.beginnt = beginnt;
      zustand.dran = dran;
      zustand.ich = ich;
      const lage = V.ausZuegen(zuege, 1);
      zustand.lage = lage;
      zustand.aus = aus || lage.sieger !== null;
      // Die neuen Steine: Beim ersten Bild (oder nach einer neuen Partie
      // aus der Datenbank) liegen viele auf einmal – die fallen schnell und
      // ohne Ton, nur der letzte richtig.
      const neu = zuege.slice(zustand.zuege.length);
      const b = V.neuesBrett();
      for (const z of zustand.zuege) V.setze(b, Number(z), 1);
      const viele = neu.length > 1;
      [...neu].forEach((z, i) => {
        const c = Number(z);
        const r = V.setze(b, c, 1);
        const stein = (zustand.zuege.length + i) % 2 === 0 ? 1 : 2;
        const knoten = steinKnoten(c, r, wessen(stein, beginnt));
        steine.append(knoten);
        zustand.knoten.push(knoten);
        const letzter = i === neu.length - 1;
        if (!viele || letzter) fallen(knoten, r, { leise: viele && !letzter });
      });
      zustand.zuege = zuege;
      zustand.knoten.forEach((k, i) => k.classList.toggle("ist-letzter", i === zustand.knoten.length - 1 && lage.sieger === null));
      // Die Reihe, die gewonnen hat.
      const sieg = new Set((lage.reihe || []).map(([c, r]) => `${c},${r}`));
      const b2 = V.neuesBrett();
      zustand.knoten.forEach((k, i) => {
        const c = Number(zuege[i]);
        const r = V.setze(b2, c, 1);
        k.classList.toggle("ist-sieg", sieg.has(`${c},${r}`));
      });
      brett.classList.toggle("ist-aus", lage.sieger !== null && lage.sieger !== 0);
      feld.classList.toggle("ist-dran", Boolean(!zustand.aus && dran && dran === ich));
      feld.dataset.dran = dran || "";
      beschrifte();
      zeige(zeiger);
      return lage;
    }

    return { knoten: feld, zeichne, fokus: () => knoepfe[3]?.focus({ preventScroll: true }) };
  }

  // Das Bild im Menü: ein kleines Brett mit einer Viererreihe, schräg hinauf.
  function held() {
    const bild = el("div", "vr-held-bild");
    const MUSTER = ["", "b", "ab", "bab", "abba", "a", "b"];
    MUSTER.forEach((spalte, c) => {
      [...spalte].forEach((sitz, r) => {
        const s = el("span", `vr-held-stein ist-${sitz}${(c === r && sitz === "a" && c <= 3) ? " ist-reihe" : ""}`);
        s.style.setProperty("--c", String(c));
        s.style.setProperty("--r", String(r));
        bild.append(s);
      });
    });
    return bild;
  }

  // Wer am Zug ist und wie es ausging, als Sitz (a, b) oder u.
  function lage(zuege, { roh, beginnt }) {
    const l = V.ausZuegen(roh, 1);
    const ende = l.sieger === null ? null : l.sieger === 0 ? "u" : (l.sieger === 1 ? beginnt : anderer(beginnt));
    const dran = ende ? null : (zuege.length % 2 === 0 ? beginnt : anderer(beginnt));
    return { ...l, ende, dran };
  }

  Z.starte({
    id: "viererreihe",
    titel: "Viererreihe",
    seite: "viererreihe",
    unter: "Lass die Steine fallen. Wer zuerst vier gleiche in einer Reihe hat – waagrecht, senkrecht oder schräg –, gewinnt.",
    held,
    trenner: "",
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zum Lernen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Zum Warmwerden" },
      mittel: { name: "Mittel", sterne: 2, satz: "Eine echte Aufgabe" },
      schwer: { name: "Schwer", sterne: 3, satz: "Kaum zu schlagen" },
    },
    texte: { start: "tippe auf eine Spalte", remis: "Unentschieden – das Brett ist voll." },
    lage,
    darf: (l, zug, sitz) => l.dran === sitz && /^[0-6]$/.test(zug) && V.frei(l.brett, Number(zug)),
    brett: ({ zug }) => brettBauen({ beiZug: (c) => zug(String(c)) }),
    computer(l, sitz, stufe) {
      let c = -1;
      try { c = V.computerZug(l.brett, l.amZug, stufe, { zeit: 650 }); } catch (fehler) { console.warn("Der Computer kam nicht weiter", fehler); }
      if (c < 0 || !V.frei(l.brett, c)) c = [3, 2, 4, 1, 5, 0, 6].find((x) => V.frei(l.brett, x));
      return String(c);
    },
  });
})();
