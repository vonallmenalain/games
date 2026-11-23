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
 * sonst wartet er.
 *
 * Jede Partie hat ihr eigenes Labyrinth, erzeugt aus der Saat (so sehen es
 * im Duell beide gleich): Räume und Gänge, Türen in Engstellen, Platten,
 * zwei Starts und zwei Fahnen – so lange neu gewürfelt, bis es lösbar ist,
 * keine allein zu ihrer Fahne kommt, der gemeinsame Weg so lang ist, wie der
 * Grad es will, und man sich oft genug die Tür aufhalten muss. Der Grad (0
 * bis 7): die Stufe (0 bis 3, im Duell 1) und dazu alle zwei Partien in
 * Folge eins mehr, höchstens vier (neuePartie legt das in die obersten Bits
 * der Saat). Die vier gezeichneten Labyrinthe von früher bleiben als Ersatz
 * und für die Prüfungen.
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
  const RICHTUNGEN = ["N", "O", "S", "W"];

  // --- Labyrinthe erzeugen ------------------------------------------------------
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

  // Je Grad: Räume (breit × hoch), Türen, Farben, wie viele Wände zusätzlich
  // offen sind, wie lang der gemeinsame Weg sein darf, wie oft man sich eine
  // Tür aufhalten muss.
  const GRADE = [
    { rw: 4, rh: 2, tueren: 2, farben: 2, offen: 0.30, lang: [10, 22], hilfe: 2 },
    { rw: 4, rh: 3, tueren: 2, farben: 2, offen: 0.25, lang: [16, 28], hilfe: 2 },
    { rw: 5, rh: 3, tueren: 3, farben: 2, offen: 0.22, lang: [20, 34], hilfe: 2 },
    { rw: 5, rh: 3, tueren: 3, farben: 3, offen: 0.20, lang: [24, 40], hilfe: 3 },
    { rw: 6, rh: 3, tueren: 3, farben: 3, offen: 0.18, lang: [28, 46], hilfe: 3 },
    { rw: 6, rh: 4, tueren: 4, farben: 3, offen: 0.16, lang: [32, 54], hilfe: 3 },
    { rw: 7, rh: 4, tueren: 4, farben: 3, offen: 0.15, lang: [36, 60], hilfe: 4 },
    { rw: 7, rh: 4, tueren: 5, farben: 3, offen: 0.14, lang: [40, 70], hilfe: 4 },
  ];
  const STUFEN_GRAD = { leicht: 0, einfach: 1, mittel: 2, schwer: 3 };
  const DUELL_GRAD = 1;
  const MEHR_HOECHSTENS = 4;
  const V = [[-1, 0], [0, 1], [1, 0], [0, -1]];

  // Ein Entwurf: ein Labyrinth aus Räumen (Tiefensuche), ein paar Wände mehr
  // auf, Türen in Engstellen, Platten, Starts und Fahnen.
  function entwurf(rnd, g) {
    const W = g.rw * 2 + 1; const H = g.rh * 2 + 1;
    const wand = new Uint8Array(W * H).fill(1);
    const besucht = new Uint8Array(g.rw * g.rh);
    const stapel = [[Math.floor(rnd() * g.rw), Math.floor(rnd() * g.rh)]];
    besucht[stapel[0][1] * g.rw + stapel[0][0]] = 1;
    wand[(stapel[0][1] * 2 + 1) * W + stapel[0][0] * 2 + 1] = 0;
    while (stapel.length) {
      const [x, y] = stapel[stapel.length - 1];
      const nachbarn = V.map(([dy, dx]) => [x + dx, y + dy]).filter(([nx, ny]) => nx >= 0 && ny >= 0 && nx < g.rw && ny < g.rh && !besucht[ny * g.rw + nx]);
      if (!nachbarn.length) { stapel.pop(); continue; }
      const [nx, ny] = nachbarn[Math.floor(rnd() * nachbarn.length)];
      besucht[ny * g.rw + nx] = 1;
      wand[(ny * 2 + 1) * W + nx * 2 + 1] = 0;
      wand[(y + ny + 1) * W + (x + nx + 1)] = 0;
      stapel.push([nx, ny]);
    }
    for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
      if (wand[y * W + x] && (x % 2 === 1 || y % 2 === 1) && rnd() < g.offen) wand[y * W + x] = 0;
    }
    const frei = [];
    for (let f = 0; f < W * H; f += 1) if (!wand[f]) frei.push(f);
    const nimm = (liste) => liste.splice(Math.floor(rnd() * liste.length), 1)[0];
    const eng = frei.filter((f) => {
      const n = V.map(([dy, dx]) => !wand[f + dy * W + dx]);
      return (n[0] && n[2] && !n[1] && !n[3]) || (n[1] && n[3] && !n[0] && !n[2]);
    });
    if (eng.length < g.tueren) return null;
    const tuer = {};
    for (let i = 0; i < g.tueren; i += 1) {
      const f = nimm(eng);
      frei.splice(frei.indexOf(f), 1);
      tuer[f] = String(1 + (i % g.farben));
    }
    const platte = {};
    for (let p = 1; p <= g.farben; p += 1) platte[nimm(frei)] = String(p);
    const l = { w: W, h: H, wand, tuer, platte };
    l.a = nimm(frei); l.b = nimm(frei); l.A = nimm(frei); l.B = nimm(frei);
    return l;
  }

  // Kommt eine allein zu ihrer Fahne, während die andere am Start steht?
  function allein(l, sitz) {
    const start = l[sitz]; const ziel = l[sitz.toUpperCase()]; const andere = l[anderer(sitz)];
    const gesehen = new Uint8Array(l.w * l.h);
    const offen = [start];
    gesehen[start] = 1;
    while (offen.length) {
      const f = offen.pop();
      if (f === ziel) return true;
      for (const [dy, dx] of V) {
        const n = f + dy * l.w + dx;
        if (gesehen[n] || n === andere || l.wand[n]) continue;
        const p = l.tuer[n];
        if (p && l.platte[andere] !== p) continue;
        gesehen[n] = 1;
        offen.push(n);
      }
    }
    return false;
  }

  // Wie oft geht eine durch eine Tür, deren Platte gerade die andere hält?
  function hilfen(l, weg) {
    const pos = { a: l.a, b: l.b };
    let n = 0;
    for (const z of weg) {
      const sitz = z[0];
      const [dr, dc] = RICHTUNG[z[1]];
      const nach = pos[sitz] + dr * l.w + dc;
      const p = l.tuer[nach];
      if (p && l.platte[pos[anderer(sitz)]] === p && l.platte[pos[sitz]] !== p) n += 1;
      pos[sitz] = nach;
    }
    return n;
  }

  // Das Labyrinth zu einer Saat und einem Grad – als Karte wie oben gezeichnet.
  function erzeuge(saat, grad) {
    const g = GRADE[Math.max(0, Math.min(GRADE.length - 1, grad))];
    const rnd = wuerfel((Number(saat) ^ Math.imul(grad + 1, 0x9e3779b1)) >>> 0);
    for (let i = 0; i < 4000; i += 1) {
      const l = entwurf(rnd, g);
      if (!l || allein(l, "a") || allein(l, "b")) continue;
      const weg = loese(l, l.a, l.b);
      if (!weg.length || weg.length < g.lang[0] || weg.length > g.lang[1]) continue;
      if (hilfen(l, weg) < g.hilfe) continue;
      const karte = [];
      for (let r = 0; r < l.h; r += 1) {
        let z = "";
        for (let c = 0; c < l.w; c += 1) {
          const f = r * l.w + c;
          z += l.wand[f] ? "#" : f === l.a ? "a" : f === l.b ? "b" : f === l.A ? "A" : f === l.B ? "B"
            : l.platte[f] ? l.platte[f] : l.tuer[f] ? "!?%"[Number(l.tuer[f]) - 1] : ".";
        }
        karte.push(z);
      }
      return karte;
    }
    return null;
  }

  // Ein Labyrinth nach Namen: «leicht» … «schwer» (die gezeichneten) oder
  // «g3-123456» (erzeugt: Grad 3, Saat 123456).
  const gelesen = new Map();
  function labyrinth(name) {
    if (gelesen.has(name)) return gelesen.get(name);
    let karte = LABYRINTHE[name];
    let grad = STUFEN_GRAD[name] ?? DUELL_GRAD;
    const m = /^g(\d)-(\d+)$/.exec(String(name));
    if (!karte && m) {
      grad = Number(m[1]);
      karte = erzeuge(Number(m[2]), grad) || LABYRINTHE[["leicht", "einfach", "mittel", "schwer"][Math.min(3, grad)]];
    }
    if (!karte) karte = LABYRINTHE.einfach;
    const h = karte.length; const w = karte[0].length;
    const l = { name, karte, h, w, grad, platte: {}, tuer: {}, wand: new Uint8Array(w * h) };
    karte.forEach((zeile, r) => [...zeile].forEach((ch, c) => {
      const f = r * w + c;
      if (ch === "#") l.wand[f] = 1;
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
  // von Zügen wie «aN». Ein Zustand ist pa · Felder + pb.
  function loese(l, pa0, pb0) {
    const N = l.w * l.h;
    const vor = new Int32Array(N * N).fill(-1);
    const zug = new Int8Array(N * N);
    const s0 = pa0 * N + pb0;
    vor[s0] = s0;
    const schlange = new Int32Array(N * N);
    let kopf = 0;
    let fuss = 0;
    schlange[fuss++] = s0;
    const offen = (f, pa, pb) => {
      if (f < 0 || f >= N || l.wand[f]) return false;
      const p = l.tuer[f];
      return !p || pa === f || pb === f || l.platte[pa] === p || l.platte[pb] === p;
    };
    while (kopf < fuss) {
      const s = schlange[kopf++];
      const pa = Math.floor(s / N); const pb = s - pa * N;
      if (pa === l.A && pb === l.B) {
        const plan = [];
        for (let k = s; k !== s0; k = vor[k]) plan.push(`${zug[k] < 4 ? "a" : "b"}${RICHTUNGEN[zug[k] & 3]}`);
        return plan.reverse();
      }
      for (let wer = 0; wer < 2; wer += 1) {
        const von = wer ? pb : pa;
        const r = Math.floor(von / l.w); const c = von - r * l.w;
        for (let d = 0; d < 4; d += 1) {
          const nr = r + V[d][0]; const nc = c + V[d][1];
          if (nr < 0 || nc < 0 || nr >= l.h || nc >= l.w) continue;
          const nach = nr * l.w + nc;
          if (nach === (wer ? pa : pb) || !offen(nach, pa, pb)) continue;
          const ns = wer ? pa * N + nach : nach * N + pb;
          if (vor[ns] >= 0) continue;
          vor[ns] = s;
          zug[ns] = wer * 4 + d;
          schlange[fuss++] = ns;
        }
      }
    }
    return [];
  }

  // Welches Labyrinth: der Grad aus der Stufe und den obersten Bits der Saat,
  // das Labyrinth aus dem Rest.
  function welches(saat, stufe) {
    const s = Number(saat) >>> 0;
    const grad = Math.min(GRADE.length - 1, (STUFEN_GRAD[stufe] ?? DUELL_GRAD) + (s >>> 28));
    return `g${grad}-${s & 0x0fffffff}`;
  }
  // Eine neue Partie: alle zwei Partien in Folge (nr) ein Grad mehr.
  function neuePartie(stufe, { nr = 0 } = {}) {
    const mehr = Math.min(MEHR_HOECHSTENS, Math.floor((Number(nr) || 0) / 2));
    return { saat: ((mehr << 28) | Math.floor(Math.random() * 0x10000000)) >>> 0 };
  }

  // --- Die Regeln -----------------------------------------------------------------
  function lage(zuege, { saat, stufe }) {
    return lageAuf(labyrinth(welches(saat, stufe)), zuege);
  }
  function lageAuf(l, zuege) {
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
    return { lab: l.name, grad: l.grad, pos: { ...pos }, dran: ende ? null : "beide", ende, uebrig, letzter, schritte: l.schritte };
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
    for (const d of RICHTUNGEN) {
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
    const stufeText = el("span", "zw-zl-level");
    const schritte = el("span", "zw-zl-schritte");
    kopf.append(stufeText, schritte);
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
      stufeText.textContent = `Level ${lab.grad + 1}`;
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
    unter: "Zusammen! Jede führt ihre Figur zur Fahne. Türen gehen nur auf, solange jemand auf der Platte gleicher Farbe steht – haltet sie euch gegenseitig auf. Jedes Mal ein neues Labyrinth.",
    held,
    trenner: ".",
    gemeinsam: true,
    stufen: {
      leicht: { name: "Ganz leicht", sterne: 0, satz: "Kleine Labyrinthe, zwei Türen" },
      einfach: { name: "Einfach", sterne: 1, satz: "Etwas grösser" },
      mittel: { name: "Mittel", sterne: 2, satz: "Drei Türen" },
      schwer: { name: "Schwer", sterne: 3, satz: "Drei Farben, lange Wege" },
    },
    texte: { start: "los geht's", geschafft: "Geschafft – beide sind am Ziel!", verpasst: "Die Schritte sind aus – nicht geschafft." },
    lage,
    darf,
    brett,
    computer,
    // Was der Lautsprecher beim Satz noch vorliest: die Schritte.
    vorlesen: (b) => (b.lage.ende ? "" : `Level ${(b.lage.grad ?? 0) + 1}. Noch ${b.lage.uebrig} Schritte`),
    satz,
    neuePartie,
    fuerPruefung: { plan, LABYRINTHE, labyrinth, lageAuf, welches, erzeuge, allein, GRADE },
  });
})();
