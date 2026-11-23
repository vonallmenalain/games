/*
 * zwillinge.js – Zwillings-Labyrinth: zu zweit durchs Labyrinth.
 * ---------------------------------------------------------------------------
 * Die Seite /zwillinge. Ein Spiel miteinander (gemeinsam), und beide sind
 * zugleich dran: Jede steuert ihre Figur (a in Koralle, b in Gold) durch
 * dasselbe Labyrinth zu ihrer Fahne. Türen gehen nur auf, solange jemand auf
 * der Bodenplatte gleicher Farbe steht – darum muss man sich gegenseitig
 * die Türen aufhalten. Stehen beide auf ihrer Fahne, ist es geschafft;
 * gehen die Schritte aus, nicht.
 *
 * Eine Tür bleibt offen, solange jemand in ihr steht. In ein Feld, in dem
 * die andere steht, kommt man nicht.
 *
 * Gegen den Computer ist er der Zwilling: Er sucht den kürzesten Weg für
 * beide zusammen und macht seinen nächsten Schritt daraus, sobald er kann –
 * sonst wartet er. Die Stufe ist das Labyrinth; im Duell ist es eines der
 * beiden mittleren (aus der Saat).
 *
 * Ein Zug: «aN» – wer (a oder b) und wohin (N, O, S, W). Durch Punkte
 * getrennt.
 */
(() => {
  "use strict";

  if (document.body?.dataset?.page !== "zwillinge") return;

  const Z = window.LernappZwei;
  if (!Z) return;
  const el = Z.el;
  const anderer = Z.anderer;

  // # Wand · . Boden · a b Start · A B Fahne · 1 2 3 Platte · ! ? % Tür
  // (zur Platte 1, 2, 3).
  const LABYRINTHE = {
    leicht: [
      "#########",
      "#a..!.2A#",
      "#########",
      "#b.1..?B#",
      "#########",
    ],
    einfach: [
      "#########",
      "#a.1#..B#",
      "#...!...#",
      "###?#.###",
      "#b..2...#",
      "#.....A.#",
      "#########",
    ],
    mittel: [
      "###########",
      "#a..!...B.#",
      "#...#.2...#",
      "#####?#####",
      "#b.1......#",
      "#.....#A..#",
      "###########",
    ],
    schwer: [
      "###########",
      "#a..!...%B#",
      "#...#.2.###",
      "#####?#####",
      "#b.1.....A#",
      "#..3..#...#",
      "###########",
    ],
  };
  const TUER = { "!": "1", "?": "2", "%": "3" };
  const RICHTUNG = { N: [-1, 0], O: [0, 1], S: [1, 0], W: [0, -1] };

  const gelesen = new Map();
  function labyrinth(name) {
    if (gelesen.has(name)) return gelesen.get(name);
    const karte = LABYRINTHE[name];
    const h = karte.length; const w = karte[0].length;
    const l = { name, karte, h, w, platte: {}, tuer: {} };
    karte.forEach((zeile, r) => [...zeile].forEach((ch, c) => {
      const f = r * w + c;
      if (ch === "a") l.a = f;
      if (ch === "b") l.b = f;
      if (ch === "A") l.A = f;
      if (ch === "B") l.B = f;
      if ("123".includes(ch)) l.platte[f] = ch;
      if (TUER[ch]) l.tuer[f] = TUER[ch];
    }));
    l.kuerzest = loese(l, l.a, l.b).length;
    l.schritte = l.kuerzest * 2 + 10;
    gelesen.set(name, l);
    return l;
  }

  // Ist f begehbar, wenn a auf pa und b auf pb steht?
  function frei(l, f, pa, pb) {
    const r = Math.floor(f / l.w); const c = f % l.w;
    if (r < 0 || c < 0 || r >= l.h || c >= l.w) return false;
    if (l.karte[r][c] === "#") return false;
    const p = l.tuer[f];
    if (p) return pa === f || pb === f || l.platte[pa] === p || l.platte[pb] === p;
    return true;
  }
  function schritt(l, pos, sitz, d) {
    const von = pos[sitz];
    const [dr, dc] = RICHTUNG[d];
    const r = Math.floor(von / l.w) + dr; const c = (von % l.w) + dc;
    if (r < 0 || c < 0 || r >= l.h || c >= l.w) return -1;
    const nach = r * l.w + c;
    if (nach === pos[anderer(sitz)]) return -1;
    return frei(l, nach, pos.a, pos.b) ? nach : -1;
  }

  // Der kürzeste gemeinsame Weg (Breitensuche über beide Plätze): eine Liste
  // von Zügen wie «aN».
  function loese(l, pa, pb) {
    const start = `${pa},${pb}`;
    const vor = new Map([[start, null]]);
    const schlange = [[pa, pb]];
    while (schlange.length) {
      const [a, b] = schlange.shift();
      if (a === l.A && b === l.B) {
        const plan = [];
        for (let k = `${a},${b}`; vor.get(k); k = vor.get(k).von) plan.unshift(vor.get(k).zug);
        return plan;
      }
      for (const sitz of ["a", "b"]) {
        for (const d of Object.keys(RICHTUNG)) {
          const pos = { a, b };
          const nach = schritt(l, pos, sitz, d);
          if (nach < 0) continue;
          const na = sitz === "a" ? nach : a; const nb = sitz === "b" ? nach : b;
          const k = `${na},${nb}`;
          if (vor.has(k)) continue;
          vor.set(k, { von: `${a},${b}`, zug: `${sitz}${d}` });
          schlange.push([na, nb]);
        }
      }
    }
    return [];
  }

  const welches = (saat, stufe) => (LABYRINTHE[stufe] ? stufe : ["einfach", "mittel"][(Number(saat) >>> 0) % 2]);

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { saat, stufe }) {
    const l = labyrinth(welches(saat, stufe));
    const pos = { a: l.a, b: l.b };
    let ende = null;
    let letzter = null;
    for (const z of zuege) {
      const m = /^([ab])([NOSW])$/.exec(z);
      const nach = m ? schritt(l, pos, m[1], m[2]) : -1;
      if (!m || ende || nach < 0) return { lab: l.name, pos, dran: null, ende, kaputt: true, uebrig: l.schritte - zuege.length, letzter };
      pos[m[1]] = nach;
      letzter = { sitz: m[1], nach };
      if (pos.a === l.A && pos.b === l.B) ende = "g";
    }
    const uebrig = l.schritte - zuege.length;
    if (!ende && uebrig <= 0) ende = "v";
    return { lab: l.name, pos: { ...pos }, dran: ende ? null : "beide", ende, uebrig, letzter, schritte: l.schritte };
  }

  function darf(l, zug, sitz) {
    const m = /^([ab])([NOSW])$/.exec(zug);
    if (!m || l.ende || m[1] !== sitz) return false;
    return schritt(labyrinth(l.lab), l.pos, sitz, m[2]) >= 0;
  }

  // --- Der Computer (als Zwilling) -------------------------------------------------
  // Ein eigener Schritt, der den kürzesten gemeinsamen Weg um eins
  // verkürzt – sonst wartet er (null), bis die andere sich bewegt. So geht
  // er nie zu früh von einer Platte, die sie noch braucht.
  function plan(l) {
    const lab = labyrinth(l.lab);
    return loese(lab, l.pos.a, l.pos.b);
  }
  function computer(l, sitz) {
    if (l.ende) return null;
    const lab = labyrinth(l.lab);
    const weit = loese(lab, l.pos.a, l.pos.b).length;
    if (!weit) return null;
    for (const d of Object.keys(RICHTUNG)) {
      const nach = schritt(lab, l.pos, sitz, d);
      if (nach < 0) continue;
      const pos = { ...l.pos, [sitz]: nach };
      const rest = (pos.a === lab.A && pos.b === lab.B) ? 0 : loese(lab, pos.a, pos.b).length;
      if (rest === weit - 1 && (rest > 0 || (pos.a === lab.A && pos.b === lab.B))) return { zug: `${sitz}${d}`, warte: 650 + Math.random() * 300 };
    }
    return null;
  }

  // --- Was über dem Labyrinth steht -------------------------------------------------
  function satz(l, { ich, name, modus }) {
    if (l.ende) return null;
    const lab = labyrinth(l.lab);
    if (!l.letzter) return { text: "Los geht's – jede führt ihre Figur zur Fahne!", sitz: null };
    if (ich && l.pos[ich] === lab[ich.toUpperCase()]) {
      return { text: `Du bist am Ziel! ${modus === "computer" ? "Hilf dem Computer" : `Hilf ${name(anderer(ich))}`} – oder warte.`, sitz: ich };
    }
    return { text: `Noch ${l.uebrig} Schritte – helft euch mit den Platten!`, sitz: null };
  }

  // --- Das Bild -------------------------------------------------------------------
  function held() {
    const bild = el("div", "zw-zl-held");
    const muster = ["#", "#", "#", "#", "#", "a", ".", "!", "A", "#", "#", "1", "#", "b", "#", "#", "#", "#", "#", "#"];
    muster.forEach((ch) => bild.append(el("span", `zw-zl-held-feld ist-${{ "#": "wand", ".": "boden", "!": "tuer", "1": "platte", a: "a", b: "b", A: "ziel" }[ch]}`)));
    return bild;
  }

  function brett({ zug, ton, knopf, ruhig }) {
    const knoten = el("div", "zw-zl");
    const kopf = el("div", "zw-zl-kopf");
    const schritte = el("span", "zw-zl-schritte");
    kopf.append(schritte);
    const feld = el("div", "zw-zl-feld");
    const figuren = { a: el("span", "zw-zl-figur ist-a"), b: el("span", "zw-zl-figur ist-b") };
    const steuer = el("div", "zw-zl-steuer");
    const knoepfe = {};
    for (const d of ["N", "W", "O", "S"]) {
      const k = knopf({ N: "↑", O: "→", S: "↓", W: "←" }[d], `zw-zl-pfeil ist-${d}`, () => gehe(d));
      k.setAttribute("aria-label", { N: "nach oben", O: "nach rechts", S: "nach unten", W: "nach links" }[d]);
      knoepfe[d] = k;
      steuer.append(k);
    }
    knoten.append(kopf, feld, steuer);

    let jetzt = null;
    let gebaut = "";
    let zellen = [];

    function gehe(d) {
      const b = jetzt;
      if (!b || b.aus || !b.ich) return;
      const z = `${b.ich}${d}`;
      if (!darf(b.lage, z, b.ich)) { ton("klack"); return; }
      zug(z);
    }
    document.addEventListener("keydown", (e) => {
      const d = { ArrowUp: "N", ArrowRight: "O", ArrowDown: "S", ArrowLeft: "W" }[e.key];
      if (!d || !jetzt || !knoten.isConnected) return;
      e.preventDefault();
      gehe(d);
    });

    function bauen(lab) {
      feld.innerHTML = "";
      feld.style.setProperty("--w", String(lab.w));
      feld.style.setProperty("--h", String(lab.h));
      zellen = [];
      lab.karte.forEach((zeile) => [...zeile].forEach((ch) => {
        const z = el("span", "zw-zl-zelle");
        z.dataset.art = ch;
        zellen.push(z);
        feld.append(z);
      }));
      feld.append(figuren.a, figuren.b);
      gebaut = lab.name;
    }

    function zeichne(b) {
      if (!b) return;
      const vorher = jetzt;
      jetzt = b;
      const l = b.lage;
      const lab = labyrinth(l.lab);
      if (gebaut !== lab.name) bauen(lab);
      zellen.forEach((z, f) => {
        const ch = lab.karte[Math.floor(f / lab.w)][f % lab.w];
        const teile = ["zw-zl-zelle"];
        if (ch === "#") teile.push("ist-wand");
        else teile.push("ist-boden");
        if (lab.platte[f]) teile.push("ist-platte", `ist-f${lab.platte[f]}`, (l.pos.a === f || l.pos.b === f) ? "ist-gedrueckt" : "");
        if (lab.tuer[f]) teile.push("ist-tuer", `ist-f${lab.tuer[f]}`, frei(lab, f, l.pos.a, l.pos.b) ? "ist-offen" : "ist-zu");
        if (f === lab.A) teile.push("ist-ziel", "ist-a");
        if (f === lab.B) teile.push("ist-ziel", "ist-b");
        z.className = teile.filter(Boolean).join(" ");
      });
      for (const sitz of ["a", "b"]) {
        const f = l.pos[sitz];
        figuren[sitz].style.setProperty("--r", String(Math.floor(f / lab.w)));
        figuren[sitz].style.setProperty("--c", String(f % lab.w));
        figuren[sitz].classList.toggle("ist-ich", sitz === b.ich);
        figuren[sitz].classList.toggle("ist-am-ziel", f === lab[sitz.toUpperCase()]);
      }
      schritte.textContent = l.ende ? "" : `Noch ${l.uebrig} Schritte`;
      schritte.classList.toggle("ist-knapp", !l.ende && l.uebrig <= 8);
      const kann = Boolean(!b.aus && b.ich && !l.ende);
      for (const [d, k] of Object.entries(knoepfe)) {
        k.disabled = !kann;
        k.classList.toggle("ist-zu", kann && !darf(l, `${b.ich}${d}`, b.ich));
      }
      steuer.className = `zw-zl-steuer ist-${b.ich || "a"}${kann ? "" : " ist-aus"}`;
      knoten.classList.toggle("ist-dran", kann);
      if (vorher && vorher.nr === b.nr && b.zuege.length > vorher.zuege.length) ton(l.letzter && lab.platte[l.letzter.nach] ? "treffer" : "tipp");
      void ruhig;
    }

    return {
      knoten,
      zeichne,
      fokus: () => Object.values(knoepfe).find((k) => !k.disabled)?.focus({ preventScroll: true }),
    };
  }

  Z.starte({
    id: "zwillinge",
    titel: "Zwillings-Labyrinth",
    seite: "zwillinge",
    unter: "Zusammen! Jede führt ihre Figur zur Fahne. Türen gehen nur auf, solange jemand auf der Platte gleicher Farbe steht – haltet sie euch gegenseitig auf.",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Zwei Gänge, zwei Türen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Ums Eck" },
      mittel: { name: "Mittel", sterne: 2, satz: "Abwechselnd aufhalten" },
      schwer: { name: "Schwer", sterne: 3, satz: "Drei Türen" },
    },
    texte: { start: "los geht's", geschafft: "Geschafft – beide sind am Ziel!", verpasst: "Die Schritte sind aus – nicht geschafft." },
    lage,
    darf,
    brett,
    computer,
    // Was der Lautsprecher beim Satz noch vorliest: die Schritte.
    vorlesen: (b) => (b.lage.ende ? "" : `Noch ${b.lage.uebrig} Schritte`),
    satz,
    neuePartie: () => ({ saat: Math.floor(Math.random() * 4294967295) }),
    fuerPruefung: { plan, LABYRINTHE, labyrinth },
  });
})();
