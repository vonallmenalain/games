/*
 * bienenflug.js – Bienenflug.
 * ---------------------------------------------------------------------------
 * Eine Sommerwiese im Abendlicht, von oben gesehen. In der Mitte eine grosse
 * Blüte, um sie kreist eine Biene. Eine Regel: Ein Tipp, und sie kehrt um.
 *
 * Auf ihrer Bahn erscheint Pollen – wer hindurchfliegt, sammelt ihn; wer zu
 * lange braucht, dem verfällt er. Und Wespen fliegen quer über die Wiese:
 * Jede kreuzt die Bahn an zwei Stellen. Wer dort ist, wenn sie kommt, ist
 * erwischt, und die Runde ist aus. Jede Wespe kündigt sich an: eine Linie
 * über die Wiese, an beiden Kreuzungen ein Ring, der sich schliesst – ist er
 * zu, ist sie da.
 *
 * Nichtstun überlebt nicht lange: Die Biene fliegt mit Nektar, und der geht
 * aus (der Ring um das Herz der Blüte). Jeder Pollen füllt ihn wieder ein
 * Stück. Gezählt wird der Pollen. Schwerer wird es mit der Zeit: Die Biene
 * fliegt schneller, die Wespen kommen schneller und kündigen sich knapper
 * an, der Pollen verfällt früher, und um den Weg bleibt weniger Luft.
 *
 * Gebaut wird die Runde aus dem Zufall (zufall.js): ohne Turnier jedes Mal
 * eine andere, im Turnier für alle im selben Versuch dieselbe. Alles hängt
 * nur an der Spielzeit seit dem Start. Sie ist immer zu schaffen, weil
 * zuerst ein Weg entsteht – wann wird umgekehrt (naechstesStueck) – und dann
 * Pollen und Wespen um ihn herum: Der Pollen liegt auf dem Weg, und keine
 * Wespe kommt dem Weg näher als das Band (band), in dem bleibt, wer jede
 * Kehre um bis zu «luft» Sekunden zu früh oder zu spät nimmt. Gleich hinter
 * dem Band beisst sie: Der «Riegel» kreuzt dort, wo ankommt, wer nicht
 * umkehrt; die «Zange» dort, wo ist, wer zu früh umgekehrt ist.
 *
 * Ein Tipp gilt zu seiner Zeit, nicht erst im nächsten Bild (tippen, voraus).
 *
 * Das Bild: Die Wiese samt Blüte wird einmal gemalt (wieseMalen) und dann
 * nur noch aufgelegt, Punkt auf Punkt – auf dem iPhone rechnet der Prozessor
 * jede gemalte Fläche, jedes Bild. Je Bild kommen nur Biene, Wespen, Pollen
 * und was durch die Luft treibt.
 *
 * Die Gegner (geist.js) fliegen als Bienen aus Licht mit, und die besten
 * Läufe lassen sich anschauen (?zuschauen=): mit denselben Wespen und
 * demselben Pollen, gebaut mit derselben Saat, nach der Uhr des Laufs.
 *
 * Die Bahn hat den Radius 100. Winkel im Bogenmass, im Bild wie auf der
 * Leinwand (x nach rechts, y nach unten); die Biene startet unten.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "beeflight") return;

  const host = document.querySelector("#bf-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall. Nur die Runde zieht daraus – der Weg, der Pollen, die Wespen.
  // Die Wiese, Samen und Funken hängen an festen Zahlen oder Math.random.
  const zufall = window.LernappZufall?.fuer?.("beeFlight") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Regeln
  // ---------------------------------------------------------------------------
  const R = 100;                   // Radius der Bahn
  const START_A = Math.PI / 2;     // unten
  const TREFFER = 13;              // so nah an einer Wespe: erwischt
  const KNAPP = 9;                 // so viel weiter weg: «haarscharf»
  const RAND = 3;                  // so viel Abstand hält jede Wespe zum Band
  const FANG = 0.14;               // so nah am Pollen (im Bogenmass): gesammelt
  // Die Biene: wie schnell sie kreist (Bogenmass je Sekunde).
  const W0 = 1.7;
  const W_MAX = 3.5;
  const W_ZEIT = 36;
  // Die Luft: um so viele Sekunden darf jede Kehre zu früh oder zu spät
  // kommen – gemessen an dem Moment, der sie genau auf den Weg brächte. Am
  // Start grosszügig (155 ms), nach 10 Sekunden gut 90, nach 20 gut 60, nach
  // 40 noch gut 40.
  const E0 = 0.155;
  const E_MIN = 0.038;
  const E_ZEIT = 13;
  const SCHWER_ZEIT = 28;          // nach so vielen Sekunden sind gut sechs Zehntel der Härte da
  const EINSTIEG = 2;              // vorher kommt keine Wespe
  const VORAUS_STUECKE = 5;        // so viele Stücke Weg stehen, bevor an einer Kehre Wespen gesetzt werden
  // Der Nektar: ein voller Ring reicht ZEHR Sekunden, ein Pollen bringt GEWINN.
  const ZEHR0 = 6.5;
  const ZEHR_MIN = 3.6;
  const GEWINN = 0.2;
  const TAKT = 1 / 240;
  const ENDE_MS = 1150;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.bienenflug", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, k) => a + (b - a) * k;
  const glatt = (k) => { const t = clamp(k, 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  // Der kürzeste Weg von Winkel b nach Winkel a (−π … π).
  const dreh = (a) => { let d = (a + Math.PI) % TAU; if (d < 0) d += TAU; return d - Math.PI; };
  // Wie schnell die Biene zur Zeit t kreist, und wie weit sie von 0 bis t
  // gekommen ist (das Integral davon): Ihr Ort hängt so nur an den Zeiten
  // der Kehren, nicht an der Länge der Rechenschritte.
  const omega = (t) => W_MAX - (W_MAX - W0) * Math.exp(-t / W_ZEIT);
  const bogen = (t) => W_MAX * t - (W_MAX - W0) * W_ZEIT * (1 - Math.exp(-t / W_ZEIT));
  const luft = (t) => E_MIN + (E0 - E_MIN) * Math.exp(-t / E_ZEIT);
  const schwere = (t) => 1 - Math.exp(-t / SCHWER_ZEIT);
  // Das Band um den Weg: Wer eine Kehre um «luft» zu spät nimmt, ist danach
  // um zweimal diesen Flug hinter dem Weg – wer sie zu früh nimmt, davor.
  const band = (t) => 2 * omega(t) * luft(t);
  const zehr = (t) => lerp(ZEHR0, ZEHR_MIN, schwere(t));
  const vorwarn = (t) => lerp(1.7, 0.95, schwere(t));
  const wespenTempo = (t) => lerp(205, 320, schwere(t));
  const pollenVor = (t) => lerp(1.6, 1.0, schwere(t));
  const pollenNach = (t) => lerp(0.75, 0.3, schwere(t));

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "start" (sie schwebt), "flug", "sturz" (erwischt oder ohne Kraft)
  const state = {
    phase: "bereit",
    schritt: "start",
    punkte: 0,
    t: 0,                   // die Spielzeit seit dem Start
    // Die Biene: ihr Winkel (fortlaufend, nicht auf einen Kreis gekürzt), die
    // Richtung, und wo und wann sie zuletzt umgekehrt ist.
    biene: { a: START_A, dir: 1, a0: START_A, t0: 0 },
    kraft: 1,
    kehren: 0,
    serie: 0,
    besteSerie: 0,
    knappe: 0,
    weg: [],
    pollen: [],
    wespen: [],
    kurs: [],
    gesetztBis: 0,
    sturz: null,
    teile: [],
    schriften: [],
    spur: [],
    zeit: 0,
    stoss: 0,
    wende: 0,
    blitz: 0,
  };

  let shell = null;
  let feld = null;
  let tippRinge = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let voraus = 0;
  let stepTimer = null;
  let gegner = null;
  let zuschauer = null;
  let summen = null;
  let wiese = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, cx: 0, cy: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klang
  // ---------------------------------------------------------------------------
  function klangAn() {
    wiese = klang()?.kulisse("bienenflug.wiese") || null;
    wiese?.setze(0.3);
    wiese?.laut(0.45);
    summen = klang()?.kulisse("bienenflug.wespe", { laut: 0 }) || null;
  }

  // Das Summen der Wespen: lauter, je näher die nächste an ihrer Kreuzung ist.
  function klangStellen() {
    let nah = 0;
    const t = state.t;
    for (let i = state.wespen.length - 1; i >= 0; i -= 1) {
      const w = state.wespen[i];
      if (w.t2 < t - 0.4) break;
      if (t < w.ab) continue;
      nah = Math.max(nah, t < w.t1 ? (t - w.ab) / (w.t1 - w.ab) : t <= w.t2 ? 1 : 1 - (t - w.t2) / 0.4);
    }
    summen?.setze(clamp(0.35 + 0.65 * nah, 0, 1));
    summen?.laut(state.schritt === "flug" ? clamp(nah, 0, 1) * 0.8 : 0);
  }

  function klangAus() {
    summen?.stop();
    wiese?.stop();
    summen = null;
    wiese = null;
  }

  // ---------------------------------------------------------------------------
  // Die Runde: der Weg, der Pollen, die Wespen
  // ---------------------------------------------------------------------------
  /*
   * Zuerst der Weg. Ein Stück ist der Flug zwischen zwei Kehren: von t0 bis
   * t1 in einer Richtung, beginnend am Winkel a0. Das nächste beginnt, wo
   * dieses endet, in der anderen Richtung.
   *
   * Der Pollen eines Stücks liegt auf dem Weg, jedes Korn dort, wo die Biene
   * zu seiner Zeit (tau) ist – aber nie näher als zweimal die Luft an einer
   * Kehre: So erreicht es auch, wer im Band vor oder hinter dem Weg fliegt.
   * Es erscheint so früh, dass man es kommen sieht (aber möglichst erst,
   * wenn die Biene auf dem Hinweg schon vorbei ist: Dann liegt es hinter
   * ihr, und sie muss umkehren), und verfällt erst, wenn auch der Letzte im
   * Band vorbei wäre – und eine Zugabe, die mit der Zeit schrumpft.
   *
   * Dann die Wespen einer Kehre – erst, wenn der Weg ein paar Stücke weiter
   * steht (VORAUS_STUECKE): Eine Wespe fliegt länger, als ein Stück dauert,
   * und darf dem Band auf ihrem ganzen Flug nicht zu nahe kommen (frei).
   *
   *   riegel    kreuzt kurz nach der Kehre dort, wo die Biene wäre, wäre sie
   *             nicht umgekehrt. Wer um mehr als die Luft zu spät umkehrt,
   *             ist ihr im Weg.
   *   zange     kreuzt kurz nach der Kehre vor dem Band: Wer viel zu früh
   *             umgekehrt ist, fliegt ihr entgegen.
   *   streuner  irgendwo gegenüber, ohne Absicht.
   *
   * Jedes Stück zieht gleich viele Zahlen, was auch daraus wird: Die Runde
   * soll an der Saat hängen, nicht an den Zweigen dieser Funktion.
   */
  function naechstesStueck() {
    const weg = state.weg;
    const n = weg.length;
    const v = n ? weg[n - 1] : null;
    const t0 = v ? v.t1 : 0;
    const a0 = v ? v.a0 + v.dir * (bogen(v.t1) - bogen(v.t0)) : START_A;
    const dir = v ? -v.dir : 1;
    const k = schwere(t0);
    const e = luft(t0);
    const z = [];
    for (let i = 0; i < 12; i += 1) z.push(zufall.zahl());
    // Das erste Stück ist lang, fast eine ganze Runde: Zeit zum Hineinfinden,
    // der erste Pollen liegt einfach voraus.
    let dauer = n === 0 ? 2.9 + 0.4 * z[0] : lerp(1.0, 0.58, k) + (lerp(2.3, 1.45, k) - lerp(1.0, 0.58, k)) * z[0] ** 1.5;
    dauer = Math.max(dauer, 4 * e + 0.3);
    const st = { t0, t1: t0 + dauer, a0, dir, z, e };
    weg.push(st);

    // Der Pollen dieses Stücks.
    const u0 = n === 0 ? 0.75 : t0 + 2 * e;
    const u1 = st.t1 - 2 * e;
    const abstand = lerp(0.66, 0.46, k);
    const zahl = clamp(Math.floor((u1 - u0) / abstand) + 1, 1, 5);
    for (let j = 0; j < zahl; j += 1) {
      // Hin und wieder fehlt eines – nur das letzte vor der Kehre nie: Es
      // zieht die Biene dorthin, wo die Wespe wartet.
      if (j < zahl - 1 && z[5 + j] < 0.22) continue;
      const lage = zahl === 1 ? 0.35 + 0.65 * z[1] : (j + (j > 0 && j < zahl - 1 ? (z[1 + j] - 0.5) * 0.5 : 0)) / (zahl - 1);
      const tau = u0 + (u1 - u0) * lage;
      const a = a0 + dir * (bogen(tau) - bogen(t0));
      const vor = n === 0 ? pollenVor(tau) : Math.max(0.45, Math.min(pollenVor(tau), 2 * (tau - t0) - 0.12));
      const p = { a, tau, von: Math.max(0, tau - vor), bis: tau + 2 * e + pollenNach(tau), zustand: 0, saat: z[1 + j] };
      state.pollen.push(p);
      state.kurs.push(`p${tau.toFixed(3)}@${(((a % TAU) + TAU) % TAU).toFixed(3)}`);
    }
  }

  // Der Weg zur Zeit t: der Winkel, an dem die Biene nach Plan ist.
  function stueckBei(t) {
    const weg = state.weg;
    for (let i = weg.length - 1; i > 0; i -= 1) {
      if (weg[i].t0 <= t) return weg[i];
    }
    return weg[0];
  }

  function planWinkel(t) {
    const st = stueckBei(t);
    return st.a0 + st.dir * (bogen(t) - bogen(st.t0));
  }

  // Eine Wespe: Sie kreuzt die Bahn am Winkel alpha zur Zeit tc, und das
  // andere Ende ihrer Sehne liegt bei beta. zuerst: ob alpha der Eintritt ist.
  function wespeAus(alpha, tc, beta, zuerst, art) {
    const v = wespenTempo(tc);
    const ax = R * Math.cos(alpha);
    const ay = R * Math.sin(alpha);
    const bx = R * Math.cos(beta);
    const by = R * Math.sin(beta);
    const lang = Math.hypot(bx - ax, by - ay);
    const t1 = zuerst ? tc : tc - lang / v;
    const ex = zuerst ? ax : bx;
    const ey = zuerst ? ay : by;
    const fx = zuerst ? bx : ax;
    const fy = zuerst ? by : ay;
    return {
      art, ex, ey, fx, fy, ux: (fx - ex) / lang, uy: (fy - ey) / lang, v, lang,
      t1, t2: t1 + lang / v, ab: t1 - vorwarn(t1), nah: Infinity, knapp: false, saat: (alpha * 7.31) % 1,
    };
  }

  const wespeX = (w, t) => w.ex + w.ux * (t - w.t1) * w.v;
  const wespeY = (w, t) => w.ey + w.uy * (t - w.t1) * w.v;
  // Wo sie im Bild ist: Weit draussen lauert sie noch und schiebt sich nur
  // langsam heran (so ist sie früh zu sehen); die letzten 45 Einheiten vor der
  // Bahn und danach fliegt sie, wie sie trifft.
  const wespeWeg = (w, t) => {
    const d = (t - w.t1) * w.v;
    return d < -45 ? -45 + (d + 45) * 0.2 : d;
  };

  // Kommt diese Wespe auf ihrem ganzen Flug dem Band um den Weg nie näher
  // als TREFFER + RAND?
  function frei(w) {
    const grenze = TREFFER + RAND;
    for (let t = w.t1 - 0.2; t <= w.t2 + 0.2; t += 1 / 120) {
      const x = wespeX(w, t);
      const y = wespeY(w, t);
      const r = Math.hypot(x, y);
      if (Math.abs(r - R) >= grenze) continue;
      const da = Math.abs(dreh(Math.atan2(y, x) - planWinkel(t)));
      const rest = Math.max(0, da - band(t));
      if (rest > 1) continue;
      if (R * R + r * r - 2 * R * r * Math.cos(rest) < grenze * grenze) return false;
    }
    return true;
  }

  // Die erste Wespe aus einer Reihe von Versuchen, die den Weg freilässt:
  // der Biss (alpha, tc) rückt in Schritten vom Band weg, das andere Ende
  // der Sehne dreht, und sie kommt von der einen oder der anderen Seite.
  const DREHUNGEN = [0, 0.7, -0.7, 1.25, -1.25];
  function sucheWespe(art, biss, schief, zuerst) {
    for (let stufe = 0; stufe < 6; stufe += 1) {
      const [alpha, tc] = biss(stufe);
      for (let d = 0; d < DREHUNGEN.length; d += 1) {
        const beta = alpha + Math.PI + schief + DREHUNGEN[d];
        for (let seite = 0; seite < 2; seite += 1) {
          const w = wespeAus(alpha, tc, beta, seite === 0 ? zuerst : !zuerst, art);
          if (w.ab > 0.2 && frei(w)) return w;
        }
      }
    }
    return null;
  }

  function setzeWespen(nr) {
    const st = state.weg[nr];
    const T = st.t1;
    state.gesetztBis = T;
    if (T < EINSTIEG) return;
    const z = st.z;
    const k = schwere(T);
    const w = omega(T);
    const h = (TREFFER + RAND) / R;
    const neu = [];
    // Der Riegel. An der ersten Kehre immer – sie lehrt die Regel.
    if (nr === 0 || z[10] < lerp(0.8, 0.96, k)) {
      const riegel = sucheWespe("riegel", (stufe) => {
        const spaet = luft(T) + h / (2 * w) + 0.012 + stufe * 0.02;
        return [st.a0 + st.dir * (bogen(T + spaet) - bogen(st.t0)), T + spaet];
      }, (z[6] - 0.5) * 1.5, z[7] < 0.5);
      if (riegel) neu.push(riegel);
    }
    // Die Zange – erst, wenn es ernst wird.
    if (nr > 1 && z[11] < lerp(-0.25, 0.55, k)) {
      const tc = T + lerp(0.2, 0.5, z[8]);
      const zange = sucheWespe("zange", (stufe) => [planWinkel(tc) - st.dir * (band(tc) + h + 0.03 + stufe * 0.04), tc], (z[9] - 0.5) * 1.5, z[7] >= 0.5);
      if (zange) neu.push(zange);
    }
    // Ein Streuner, gegenüber.
    if (nr > 0 && z[9] < lerp(0.12, 0.5, k)) {
      const tc = st.t0 + (st.t1 - st.t0) * (0.25 + 0.5 * z[8]);
      const streuner = sucheWespe("streuner", (stufe) => [planWinkel(tc) + Math.PI + (z[6] - 0.5) * 1.6 + stufe * 0.3, tc], (z[10] - 0.5) * 1.8, z[11] < 0.5);
      if (streuner) neu.push(streuner);
    }
    neu.sort((a, b) => a.t1 - b.t1).forEach((x) => {
      state.wespen.push(x);
      state.kurs.push(`${x.art[0]}${x.t1.toFixed(3)}:${Math.atan2(x.ey, x.ex).toFixed(3)}>${Math.atan2(x.fy, x.fx).toFixed(3)}`);
    });
  }

  // Die Runde steht bis zur Zeit t – Weg, Pollen und Wespen, so weit voraus,
  // dass sich jede Wespe rechtzeitig ankündigen kann.
  function planBis(t) {
    let schutz = 0;
    while (state.gesetztBis < t + 4.5 && schutz < 4000) {
      schutz += 1;
      naechstesStueck();
      const nr = state.weg.length - 1 - VORAUS_STUECKE;
      if (nr >= 0) setzeWespen(nr);
    }
  }

  function rundeNeu() {
    state.weg = [];
    state.pollen = [];
    state.wespen = [];
    state.kurs = [];
    state.gesetztBis = 0;
    planBis(0);
  }

  // Die Runde als Text – für die Prüfung, dass in einem Turnier alle
  // dieselbe bekommen.
  function kursText(bis = 40) {
    planBis(bis + 2);
    return state.kurs.filter((eintrag) => Number.parseFloat(eintrag.slice(1)) < bis).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "bf-platz");
    feld = shell.el("div", "bf-feld");
    canvas = document.createElement("canvas");
    canvas.className = "bf-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: zwei Ringe, die aufgehen – tippen.
    const tipp = shell.el("span", "bf-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    ["bf-tipp-ring", "bf-tipp-ring is-spaet"].forEach((klasse) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("class", klasse);
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", "14");
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", "#ffffff");
      kreis.setAttribute("stroke-width", "4");
      svg.append(kreis);
    });
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "8");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(punkt);
    tipp.append(svg);
    tippRinge = tipp;
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = shellApi.bildpunkte(cssW, cssH, 2);
    const oben = Math.min(cssH * 0.45, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && oben === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = oben;
    // Die Bahn steht so gross im Bild, wie es geht: hochkant fast über die
    // ganze Breite, quer über die ganze Höhe unter den Knöpfen.
    const hoch = cssH - oben;
    view.s = Math.min(cssW / (2 * (R + 23)), hoch / (2 * (R + 17)));
    view.cx = Math.round(cssW / 2);
    view.cy = Math.round(oben + hoch / 2);
    // Der Hinweis «tippen»: unter der Bahn, wo Platz ist – sonst rechts
    // neben ihr, damit er nicht auf der Biene liegt.
    if (tippRinge) {
      const unten = view.cy + (R + 20) * view.s;
      const drunter = cssH - unten > 44;
      tippRinge.style.left = drunter ? "50%" : `${Math.round(Math.min(cssW - 40, view.cx + (R + 62) * view.s))}px`;
      tippRinge.style.top = drunter ? `${Math.round((unten + cssH) / 2)}px` : `${Math.round(view.cy + R * 0.6 * view.s)}px`;
    }
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    wieseMalen();
    scheineMalen();
  }

  const bildX = (x) => view.cx + x * view.s;
  const bildY = (y) => view.cy + y * view.s;

  // ---------------------------------------------------------------------------
  // Zeichnen: die Wiese mit der Blüte – einmal gemalt, dann nur aufgelegt
  // ---------------------------------------------------------------------------
  let wieseBild = null;

  // Ein fester Zufall für die Wiese: Sie sieht jedes Mal gleich aus.
  function wuerfel(saat) {
    let a = saat >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Ein Blütenblatt, von der Mitte nach rechts: von r0 bis lang, so breit.
  function blattPfad(c, r0, lang, breit) {
    c.beginPath();
    c.moveTo(r0, 0);
    c.bezierCurveTo(r0 + (lang - r0) * 0.2, -breit, lang * 0.86, -breit * 0.92, lang, 0);
    c.bezierCurveTo(lang * 0.86, breit * 0.92, r0 + (lang - r0) * 0.2, breit, r0, 0);
    c.closePath();
  }

  function wieseMalen() {
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const dpr = view.dpr;
    const cx = view.cx;
    const cy = view.cy;
    wieseBild = document.createElement("canvas");
    wieseBild.width = canvas.width;
    wieseBild.height = canvas.height;
    const c = wieseBild.getContext("2d");
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const rnd = wuerfel(20261126);
    const u = Math.max(1, s * 0.7);
    const gross = Math.hypot(W, H);
    const schatten = (blur, dx, dy, farbe) => {
      c.shadowColor = farbe;
      c.shadowBlur = blur * dpr;
      c.shadowOffsetX = dx * dpr;
      c.shadowOffsetY = dy * dpr;
    };
    const ohneSchatten = () => { c.shadowColor = "transparent"; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; };
    const weit = (x, y) => Math.hypot(x - cx, y - cy) / s;

    // Der Grund: Gras im Abendlicht, das Licht kommt von links oben.
    const grund = c.createLinearGradient(0, 0, W * 0.8, H);
    grund.addColorStop(0, "#9fc24a");
    grund.addColorStop(0.4, "#6ea43b");
    grund.addColorStop(0.75, "#468532");
    grund.addColorStop(1, "#2c6a2d");
    c.fillStyle = grund;
    c.fillRect(0, 0, W, H);

    // Flecken: hellere und dunklere Stellen im Gras.
    for (let i = 0; i < 70; i += 1) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = (26 + rnd() * 70) * u;
      const hell = rnd() < 0.5;
      const fleck = c.createRadialGradient(x, y, 0, x, y, r);
      fleck.addColorStop(0, hell ? "rgba(214, 234, 118, 0.22)" : "rgba(22, 74, 34, 0.24)");
      fleck.addColorStop(1, hell ? "rgba(214, 234, 118, 0)" : "rgba(22, 74, 34, 0)");
      c.fillStyle = fleck;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // Halme: viele kurze, gebogene Striche.
    const GRUEN = ["#2f7a2e", "#3d8f34", "#57a63c", "#7cbc48", "#a5d15a", "#24652a", "#c3de6c"];
    const halme = Math.min(5200, Math.round((W * H) / 46));
    c.lineCap = "round";
    for (let i = 0; i < halme; i += 1) {
      const x = rnd() * W;
      const y = rnd() * H;
      const lang = (5 + rnd() * 9) * u;
      const w = -Math.PI / 2 + (rnd() - 0.5) * 2.2 + 0.5;
      const licht = clamp(1 - (x / W) * 0.5 - (y / H) * 0.5 + (rnd() - 0.5) * 0.7, 0, 0.999);
      c.strokeStyle = GRUEN[Math.floor(licht * 5 + rnd() * 2)];
      c.globalAlpha = 0.55 + rnd() * 0.4;
      c.lineWidth = (0.8 + rnd() * 1) * u;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(x + Math.cos(w) * lang * 0.5 + (rnd() - 0.5) * 4 * u, y + Math.sin(w) * lang * 0.5, x + Math.cos(w + 0.5) * lang, y + Math.sin(w + 0.5) * lang);
      c.stroke();
    }
    c.globalAlpha = 1;

    // Klee: Nester aus dreiblättrigen Blättchen.
    const kleeblatt = (x, y, r, w0) => {
      schatten(2.5, 1.2, 1.8, "rgba(14, 50, 20, 0.5)");
      c.fillStyle = rnd() < 0.5 ? "#2f8436" : "#3b9440";
      c.beginPath();
      for (let j = 0; j < 3; j += 1) {
        const w = w0 + (j * TAU) / 3;
        c.moveTo(x + Math.cos(w) * r * 0.62 + r * 0.62, y + Math.sin(w) * r * 0.62);
        c.arc(x + Math.cos(w) * r * 0.62, y + Math.sin(w) * r * 0.62, r * 0.62, 0, TAU);
      }
      c.fill();
      ohneSchatten();
      c.strokeStyle = "rgba(190, 232, 150, 0.55)";
      c.lineWidth = Math.max(0.6, r * 0.13);
      c.beginPath();
      for (let j = 0; j < 3; j += 1) {
        const w = w0 + (j * TAU) / 3;
        c.arc(x + Math.cos(w) * r * 0.5, y + Math.sin(w) * r * 0.5, r * 0.34, w - 1.1, w + 1.1);
        c.moveTo(x, y);
      }
      c.stroke();
    };
    const nester = Math.round(clamp((W * H) / 30000, 8, 26));
    for (let i = 0; i < nester; i += 1) {
      const x0 = rnd() * W;
      const y0 = rnd() * H;
      const zahl = 4 + Math.floor(rnd() * 7);
      for (let j = 0; j < zahl; j += 1) {
        const x = x0 + (rnd() - 0.5) * 46 * u;
        const y = y0 + (rnd() - 0.5) * 46 * u;
        const d = weit(x, y);
        if (d < 80 || Math.abs(d - R) < 13) { rnd(); rnd(); continue; }
        kleeblatt(x, y, (3.2 + rnd() * 2.6) * u, rnd() * TAU);
      }
    }

    // Die Bahn: nur angedeutet – ein heller Hauch im Gras und feine Punkte.
    c.strokeStyle = "rgba(255, 250, 205, 0.1)";
    c.lineWidth = 17 * s;
    c.beginPath();
    c.arc(cx, cy, R * s, 0, TAU);
    c.stroke();
    c.strokeStyle = "rgba(255, 252, 220, 0.09)";
    c.lineWidth = 7 * s;
    c.beginPath();
    c.arc(cx, cy, R * s, 0, TAU);
    c.stroke();
    c.fillStyle = "rgba(255, 255, 240, 0.5)";
    c.beginPath();
    for (let i = 0; i < 72; i += 1) {
      const w = (i / 72) * TAU;
      const x = cx + Math.cos(w) * R * s;
      const y = cy + Math.sin(w) * R * s;
      const r = (i % 6 === 0 ? 1.15 : 0.7) * s;
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, TAU);
    }
    c.fill();

    // Blumen im Gras: Gänseblümchen, Hahnenfuss, Vergissmeinnicht.
    const blume = (x, y, r, art) => {
      c.save();
      c.translate(x, y);
      c.rotate(rnd() * TAU);
      if (art === 0) {
        schatten(3, 2.4, 3.4, "rgba(12, 46, 18, 0.55)");
        c.fillStyle = "#fdfdf6";
        const n = 11 + Math.floor(rnd() * 4);
        c.beginPath();
        for (let j = 0; j < n; j += 1) {
          const w = (j / n) * TAU;
          c.ellipse(Math.cos(w) * r * 0.62, Math.sin(w) * r * 0.62, r * 0.42, r * 0.17, w, 0, TAU);
          c.closePath();
        }
        c.fill();
        ohneSchatten();
        c.fillStyle = "rgba(180, 190, 215, 0.35)";
        c.beginPath();
        c.arc(r * 0.12, r * 0.14, r * 0.5, 0, TAU);
        c.fill();
        const mitte = c.createRadialGradient(-r * 0.1, -r * 0.1, 0, 0, 0, r * 0.36);
        mitte.addColorStop(0, "#ffe873");
        mitte.addColorStop(1, "#e89b0c");
        c.fillStyle = mitte;
        c.beginPath();
        c.arc(0, 0, r * 0.34, 0, TAU);
        c.fill();
      } else if (art === 1) {
        schatten(2.5, 1.8, 2.6, "rgba(12, 46, 18, 0.5)");
        c.fillStyle = "#ffd426";
        c.beginPath();
        for (let j = 0; j < 5; j += 1) {
          const w = (j / 5) * TAU;
          c.moveTo(Math.cos(w) * r * 0.45 + r * 0.42, Math.sin(w) * r * 0.45);
          c.arc(Math.cos(w) * r * 0.45, Math.sin(w) * r * 0.45, r * 0.42, 0, TAU);
        }
        c.fill();
        ohneSchatten();
        c.fillStyle = "#f08c00";
        c.beginPath();
        c.arc(0, 0, r * 0.24, 0, TAU);
        c.fill();
      } else {
        schatten(2, 1.2, 1.8, "rgba(12, 46, 18, 0.5)");
        c.fillStyle = rnd() < 0.5 ? "#8fc7ff" : "#b7a6ff";
        c.beginPath();
        for (let j = 0; j < 5; j += 1) {
          const w = (j / 5) * TAU;
          c.moveTo(Math.cos(w) * r * 0.42 + r * 0.36, Math.sin(w) * r * 0.42);
          c.arc(Math.cos(w) * r * 0.42, Math.sin(w) * r * 0.42, r * 0.36, 0, TAU);
        }
        c.fill();
        ohneSchatten();
        c.fillStyle = "#fff3a8";
        c.beginPath();
        c.arc(0, 0, r * 0.2, 0, TAU);
        c.fill();
      }
      c.restore();
    };
    const blumen = Math.round(clamp((W * H) / 5200, 34, 120));
    for (let i = 0; i < blumen; i += 1) {
      const x = rnd() * W;
      const y = rnd() * H;
      const wahl = rnd();
      const art = wahl < 0.42 ? 0 : wahl < 0.68 ? 1 : 2;
      const r = (art === 0 ? 5.2 + rnd() * 3.4 : art === 1 ? 3.6 + rnd() * 1.8 : 2.6 + rnd() * 1.4) * u;
      const d = weit(x, y);
      if (d < 84 || Math.abs(d - R) < 12 + r / s) { rnd(); rnd(); continue; }
      blume(x, y, r, art);
      // Vergissmeinnicht stehen in Grüppchen.
      if (art === 2) {
        for (let j = 0; j < 3; j += 1) {
          const x2 = x + (rnd() - 0.5) * 16 * u;
          const y2 = y + (rnd() - 0.5) * 16 * u;
          const d2 = weit(x2, y2);
          if (d2 < 84 || Math.abs(d2 - R) < 12 + r / s) { rnd(); rnd(); continue; }
          blume(x2, y2, r * (0.75 + rnd() * 0.4), 2);
        }
      }
    }

    // Tautropfen.
    for (let i = 0; i < 90; i += 1) {
      const x = rnd() * W;
      const y = rnd() * H;
      const r = (0.9 + rnd() * 1.3) * u;
      c.fillStyle = "rgba(20, 60, 30, 0.35)";
      c.beginPath();
      c.arc(x + r * 0.4, y + r * 0.5, r, 0, TAU);
      c.fill();
      c.fillStyle = "rgba(226, 246, 255, 0.78)";
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.arc(x - r * 0.3, y - r * 0.35, r * 0.4, 0, TAU);
      c.fill();
    }

    // Die Blüte. Zuerst ihr Schatten auf dem Gras – das Licht steht tief.
    c.save();
    c.translate(cx, cy);
    const dunkel = c.createRadialGradient(9 * s, 13 * s, 30 * s, 9 * s, 13 * s, 84 * s);
    dunkel.addColorStop(0, "rgba(10, 44, 20, 0.6)");
    dunkel.addColorStop(0.7, "rgba(10, 44, 20, 0.3)");
    dunkel.addColorStop(1, "rgba(10, 44, 20, 0)");
    c.fillStyle = dunkel;
    c.fillRect(-90 * s, -90 * s, 190 * s, 196 * s);

    // Kelchblätter, die zwischen den Blütenblättern hervorschauen.
    for (let i = 0; i < 7; i += 1) {
      c.save();
      c.rotate((i / 7) * TAU + 0.31);
      const gruen = c.createLinearGradient(20 * s, 0, 82 * s, 0);
      gruen.addColorStop(0, "#1f5f2a");
      gruen.addColorStop(0.7, "#3f9a3e");
      gruen.addColorStop(1, "#7cc456");
      c.fillStyle = gruen;
      schatten(4, 2, 3, "rgba(8, 40, 16, 0.5)");
      blattPfad(c, 16 * s, (76 + rnd() * 5) * s, 12 * s);
      c.fill();
      ohneSchatten();
      c.strokeStyle = "rgba(200, 240, 160, 0.4)";
      c.lineWidth = 0.8 * s;
      c.beginPath();
      c.moveTo(24 * s, 0);
      c.lineTo(74 * s, 0);
      c.stroke();
      c.restore();
    }

    // Zwei Kränze Blütenblätter: aussen tiefes Rosa mit hellen Spitzen, innen
    // heller und wärmer.
    const kranz = (zahl, lang, breit, versatz, farben, r0) => {
      for (let i = 0; i < zahl; i += 1) {
        c.save();
        c.rotate((i / zahl) * TAU + versatz + (rnd() - 0.5) * 0.07);
        const l = lang * (0.94 + rnd() * 0.1) * s;
        const b = breit * (0.92 + rnd() * 0.16) * s;
        const farbe = c.createLinearGradient(r0 * s, 0, l, 0);
        farbe.addColorStop(0, farben[0]);
        farbe.addColorStop(0.45, farben[1]);
        farbe.addColorStop(1, farben[2]);
        c.fillStyle = farbe;
        schatten(5, 2.2, 3.2, "rgba(96, 8, 48, 0.5)");
        blattPfad(c, r0 * s, l, b);
        c.fill();
        ohneSchatten();
        // Die Adern.
        c.strokeStyle = farben[3];
        c.lineWidth = 0.7 * s;
        c.beginPath();
        c.moveTo(r0 * s + 3 * s, 0);
        c.lineTo(l * 0.9, 0);
        c.moveTo(r0 * s + 5 * s, 0);
        c.quadraticCurveTo(l * 0.5, -b * 0.55, l * 0.8, -b * 0.34);
        c.moveTo(r0 * s + 5 * s, 0);
        c.quadraticCurveTo(l * 0.5, b * 0.55, l * 0.8, b * 0.34);
        c.stroke();
        // Ein Glanz auf der Seite zum Licht.
        c.fillStyle = "rgba(255, 255, 255, 0.16)";
        c.beginPath();
        c.ellipse(l * 0.62, -b * 0.3, l * 0.24, b * 0.2, -0.12, 0, TAU);
        c.fill();
        c.restore();
      }
    };
    kranz(13, 71, 15.5, 0.12, ["#9c1450", "#ee4f8b", "#ffc9dc", "rgba(140, 16, 70, 0.32)"], 10);
    kranz(13, 49, 12, 0.12 + Math.PI / 13, ["#c2255c", "#ff7fa8", "#ffe5ee", "rgba(160, 30, 80, 0.28)"], 8);
    kranz(9, 31, 8.5, 0.5, ["#e8590c", "#ffa94d", "#fff0c9", "rgba(170, 70, 10, 0.3)"], 6);

    // Das Herz: ein goldener Korb voller Staubgefässe.
    schatten(5, 1.5, 2.5, "rgba(96, 30, 0, 0.55)");
    const herz = c.createRadialGradient(-5 * s, -6 * s, 1, 0, 0, 19 * s);
    herz.addColorStop(0, "#ffe680");
    herz.addColorStop(0.55, "#f7a81b");
    herz.addColorStop(1, "#a44a00");
    c.fillStyle = herz;
    c.beginPath();
    c.arc(0, 0, 18.5 * s, 0, TAU);
    c.fill();
    ohneSchatten();
    for (let i = 0; i < 120; i += 1) {
      const r = 17.2 * s * Math.sqrt((i + 0.5) / 120);
      const w = i * 2.39996;
      const x = Math.cos(w) * r;
      const y = Math.sin(w) * r;
      const k = 0.75 + 0.5 * (i / 120);
      c.fillStyle = "rgba(110, 50, 0, 0.6)";
      c.beginPath();
      c.arc(x + 0.3 * s, y + 0.4 * s, 0.95 * s * k, 0, TAU);
      c.fill();
      c.fillStyle = i % 3 === 0 ? "#fff2a8" : "#ffcf3d";
      c.beginPath();
      c.arc(x - 0.15 * s, y - 0.2 * s, 0.72 * s * k, 0, TAU);
      c.fill();
    }
    c.fillStyle = "#fff6c4";
    for (let i = 0; i < 26; i += 1) {
      const w = (i / 26) * TAU + 0.1;
      c.beginPath();
      c.ellipse(Math.cos(w) * 19.5 * s, Math.sin(w) * 19.5 * s, 2.3 * s, 1.1 * s, w, 0, TAU);
      c.fill();
    }
    c.restore();

    // Das Abendlicht: golden von links oben, Schatten nach rechts unten.
    c.globalCompositeOperation = "soft-light";
    const licht = c.createRadialGradient(-W * 0.1, -H * 0.06, 0, -W * 0.1, -H * 0.06, gross * 1.15);
    licht.addColorStop(0, "rgba(255, 226, 130, 0.95)");
    licht.addColorStop(0.45, "rgba(255, 196, 96, 0.5)");
    licht.addColorStop(1, "rgba(30, 40, 90, 0.5)");
    c.fillStyle = licht;
    c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = "source-over";
    // Lichtbahnen, schräg durchs Bild.
    c.save();
    c.translate(0, 0);
    c.rotate(0.62);
    for (let i = 0; i < 4; i += 1) {
      const y = (-0.25 + i * 0.3 + rnd() * 0.08) * gross;
      const breit = (0.05 + rnd() * 0.06) * gross;
      const bahn = c.createLinearGradient(0, y - breit, 0, y + breit);
      bahn.addColorStop(0, "rgba(255, 236, 160, 0)");
      bahn.addColorStop(0.5, "rgba(255, 236, 160, 0.13)");
      bahn.addColorStop(1, "rgba(255, 236, 160, 0)");
      c.fillStyle = bahn;
      c.fillRect(-gross, y - breit, gross * 3, breit * 2);
    }
    c.restore();
    // Die Ränder dunkler: Der Blick bleibt in der Mitte.
    const rand = c.createRadialGradient(cx, cy, Math.min(W, H) * 0.42, cx, cy, gross * 0.72);
    rand.addColorStop(0, "rgba(8, 36, 22, 0)");
    rand.addColorStop(1, "rgba(8, 36, 22, 0.62)");
    c.fillStyle = rand;
    c.fillRect(0, 0, W, H);

    // Ganz vorn, unscharf im Gegenlicht: Halme, die von den Ecken ins Bild ragen.
    const halm = (x, y, w, lang, breit) => {
      c.save();
      c.translate(x, y);
      c.rotate(w);
      schatten(7, 0, 0, "rgba(6, 30, 14, 0.8)");
      c.fillStyle = "rgba(10, 44, 22, 0.86)";
      c.beginPath();
      c.moveTo(0, -breit);
      c.quadraticCurveTo(lang * 0.5, -breit * 1.6 - lang * 0.12, lang, -lang * 0.2);
      c.quadraticCurveTo(lang * 0.5, breit * 0.2 - lang * 0.05, 0, breit);
      c.closePath();
      c.fill();
      c.restore();
    };
    const eck = Math.min(W, H) * 0.34;
    halm(-8, H + 6, -0.95, eck * 1.05, eck * 0.07);
    halm(-10, H - eck * 0.25, -0.5, eck * 0.8, eck * 0.06);
    halm(eck * 0.3, H + 10, -1.3, eck * 0.75, eck * 0.055);
    halm(W + 8, H + 6, -2.2, eck * 1.0, eck * 0.07);
    halm(W + 10, H - eck * 0.3, -2.7, eck * 0.7, eck * 0.055);
    ohneSchatten();
  }

  // Kleine vorgemalte Scheine: das Leuchten des Pollens, der Spur, der Warnung.
  const scheine = {};
  function scheinAus(name, radius, stufen) {
    const r = Math.max(2, Math.ceil(radius * view.s * view.dpr));
    const bild = document.createElement("canvas");
    bild.width = r * 2;
    bild.height = r * 2;
    const c = bild.getContext("2d");
    const verlauf = c.createRadialGradient(r, r, 0, r, r, r);
    stufen.forEach(([wo, farbe]) => verlauf.addColorStop(wo, farbe));
    c.fillStyle = verlauf;
    c.fillRect(0, 0, r * 2, r * 2);
    scheine[name] = { bild, r: r / view.dpr };
  }

  function scheineMalen() {
    scheinAus("pollen", 13, [[0, "rgba(255, 248, 190, 0.95)"], [0.3, "rgba(255, 214, 70, 0.6)"], [1, "rgba(255, 190, 40, 0)"]]);
    scheinAus("spur", 6, [[0, "rgba(255, 244, 170, 0.9)"], [0.4, "rgba(255, 214, 80, 0.45)"], [1, "rgba(255, 200, 60, 0)"]]);
    scheinAus("warn", 17, [[0, "rgba(255, 70, 40, 0.55)"], [0.5, "rgba(255, 60, 30, 0.22)"], [1, "rgba(255, 60, 30, 0)"]]);
  }

  function schein(name, x, y, mass = 1, alpha = 1) {
    const sch = scheine[name];
    if (!sch || alpha <= 0.01) return;
    const r = sch.r * mass;
    g.globalAlpha = alpha;
    g.drawImage(sch.bild, x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: was sich bewegt
  // ---------------------------------------------------------------------------
  // Der Nektar: ein Ring um das Herz der Blüte. Wird er knapp, pocht er rot.
  function zeichneKraft() {
    const s = view.s;
    const k = clamp(state.kraft, 0, 1);
    const knapp = k < 0.3 && state.phase === "spiel";
    g.lineWidth = 5.2 * s;
    g.strokeStyle = "rgba(58, 18, 4, 0.72)";
    g.beginPath();
    g.arc(view.cx, view.cy, 25.5 * s, 0, TAU);
    g.stroke();
    if (k > 0.004) {
      const puls = knapp && !ruhig() ? 0.6 + 0.4 * Math.sin(state.zeit * 14) : 1;
      g.globalAlpha = puls;
      g.strokeStyle = knapp ? "#ff5a36" : k < 0.55 ? "#ffc23d" : "#fff6b8";
      g.lineWidth = 3.4 * s;
      g.beginPath();
      g.arc(view.cx, view.cy, 25.5 * s, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  // Was über die Wiese treibt: Samen der Pusteblume und Lichtstaub.
  const SAMEN = Array.from({ length: 7 }, (_, i) => ({
    x: hash01(i * 2.9 + 4), y: hash01(i * 6.1 + 7), v: 0.012 + hash01(i * 4.7) * 0.02, w: hash01(i * 1.3) * 6, r: 0.8 + hash01(i * 8.3) * 0.5,
  }));
  const STAUB = Array.from({ length: 26 }, (_, i) => ({
    x: hash01(i * 3.7 + 11), y: hash01(i * 5.3 + 2), t: hash01(i * 9.1) * 6, r: 0.7 + hash01(i * 2.1) * 0.9,
  }));

  function zeichneLuft() {
    const W = view.cssW;
    const H = view.cssH;
    const still = ruhig();
    const t = still ? 0 : state.zeit;
    g.fillStyle = "#fff8d0";
    for (let i = 0; i < STAUB.length; i += 1) {
      const st = STAUB[i];
      const hell = 0.5 + 0.5 * Math.sin(t * 1.3 + st.t);
      if (hell < 0.15) continue;
      g.globalAlpha = hell * 0.75;
      const x = ((st.x + t * 0.004 + Math.sin(t * 0.5 + st.t) * 0.01) % 1) * W;
      const y = ((st.y + 1 - (t * 0.006) % 1) % 1) * H;
      const r = st.r * Math.max(1, view.s * 0.6);
      g.fillRect(x, y, r, r);
    }
    g.globalAlpha = 1;
    if (still) return;
    // Pusteblumen-Samen: ein Stiel, ein Schirmchen aus feinen Strahlen.
    g.strokeStyle = "rgba(255, 255, 255, 0.85)";
    g.lineWidth = 1;
    g.beginPath();
    const u = Math.max(1, view.s * 0.7);
    for (let i = 0; i < SAMEN.length; i += 1) {
      const sa = SAMEN[i];
      const x = (((sa.x + t * sa.v) % 1.2) - 0.1) * W;
      const y = (((sa.y - t * sa.v * 0.45 + Math.sin(t * 0.6 + sa.w) * 0.02) % 1.2 + 1.2) % 1.2 - 0.1) * H;
      const r = 4.2 * sa.r * u;
      const neig = Math.sin(t * 0.9 + sa.w) * 0.4;
      for (let j = 0; j < 7; j += 1) {
        const w = -Math.PI / 2 + neig + (j - 3) * 0.42;
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(w) * r, y + Math.sin(w) * r);
      }
      g.moveTo(x, y);
      g.lineTo(x - Math.sin(neig) * r * 1.3, y + Math.cos(neig) * r * 1.3);
    }
    g.stroke();
  }

  // Der Pollen: ein leuchtendes, flaumiges Korn. Der Ring darum zeigt, wie
  // lange es noch liegt.
  function zeichnePollen() {
    const s = view.s;
    const t = state.t;
    const still = ruhig();
    for (let i = state.pollen.length - 1; i >= 0; i -= 1) {
      const p = state.pollen[i];
      if (p.bis < t - 0.3) break;
      if (p.zustand !== 0 || t < p.von) continue;
      const x = bildX(Math.cos(p.a) * R);
      const y = bildY(Math.sin(p.a) * R);
      const da = p.von <= 0 ? 1 : clamp((t - p.von) / 0.22, 0, 1);
      const rest = clamp((p.bis - t) / (p.bis - p.von), 0, 1);
      const eilt = p.bis - t < 0.7;
      const puls = still ? 1 : 1 + 0.1 * Math.sin(state.zeit * 6 + p.saat * 9);
      const blink = eilt && !still ? 0.55 + 0.45 * Math.sin(state.zeit * 22) : 1;
      schein("pollen", x, y, da * puls * 1.15, 0.9 * blink);
      g.globalAlpha = blink;
      g.fillStyle = "#ffcf2e";
      g.beginPath();
      g.arc(x, y, 5.4 * s * da, 0, TAU);
      g.fill();
      g.fillStyle = "#fff3a6";
      g.beginPath();
      g.arc(x - 1.5 * s, y - 1.7 * s, 2.5 * s * da, 0, TAU);
      g.fill();
      // Flaum: kurze Strahlen rundum.
      g.strokeStyle = "#ffe067";
      g.lineWidth = Math.max(1, 1.1 * s);
      g.beginPath();
      const w0 = still ? p.saat * 6 : p.saat * 6 + state.zeit * 0.8;
      for (let j = 0; j < 8; j += 1) {
        const w = w0 + (j / 8) * TAU;
        g.moveTo(x + Math.cos(w) * 5.6 * s * da, y + Math.sin(w) * 5.6 * s * da);
        g.lineTo(x + Math.cos(w) * 8.2 * s * da, y + Math.sin(w) * 8.2 * s * da);
      }
      g.stroke();
      // Die Uhr.
      g.strokeStyle = eilt ? "#ff7a3d" : "rgba(255, 255, 255, 0.9)";
      g.lineWidth = Math.max(1.2, 1.5 * s);
      g.beginPath();
      g.arc(x, y, 11 * s, -Math.PI / 2, -Math.PI / 2 + TAU * rest);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  // Die Ankündigung einer Wespe: ihre Linie über die Wiese, und an beiden
  // Kreuzungen ein Ring, der sich schliesst – ist er zu, ist sie da.
  function zeichneWarnung() {
    const s = view.s;
    const t = state.t;
    for (let i = state.wespen.length - 1; i >= 0; i -= 1) {
      const w = state.wespen[i];
      if (w.t2 < t - 0.3) break;
      if (t < w.ab) continue;
      const da = glatt((t - w.ab) / 0.25);
      const weg = t > w.t2 ? clamp(1 - (t - w.t2) / 0.3, 0, 1) : 1;
      const alpha = da * weg;
      // Die Linie: gestrichelt, von weit draussen bis weit draussen; die
      // Striche laufen mit der Wespe.
      const lauf = ruhig() ? 0 : (state.zeit * 46) % 15;
      g.strokeStyle = "#ff4a2e";
      g.lineWidth = Math.max(1.5, 1.6 * s);
      g.globalAlpha = 0.75 * alpha;
      g.beginPath();
      for (let d = -70 + lauf; d < w.lang + 70; d += 15) {
        g.moveTo(bildX(w.ex + w.ux * d), bildY(w.ey + w.uy * d));
        g.lineTo(bildX(w.ex + w.ux * (d + 7)), bildY(w.ey + w.uy * (d + 7)));
      }
      g.stroke();
      g.globalAlpha = 1;
      // Die zwei Kreuzungen.
      const dauer = w.t1 - w.ab;
      [[w.ex, w.ey, w.t1], [w.fx, w.fy, w.t2]].forEach(([px, py, wann]) => {
        if (t > wann + 0.25) return;
        const x = bildX(px);
        const y = bildY(py);
        const noch = clamp((wann - t) / dauer, 0, 1.6);
        const vorbei = t > wann ? clamp(1 - (t - wann) / 0.25, 0, 1) : 1;
        schein("warn", x, y, 1, alpha * vorbei);
        g.globalAlpha = alpha * vorbei;
        // Der feste Ring: so gross ist die Gefahr.
        g.strokeStyle = "#ff3b24";
        g.lineWidth = Math.max(1.6, 2 * s);
        g.beginPath();
        g.arc(x, y, TREFFER * s, 0, TAU);
        g.stroke();
        // Der Ring, der sich schliesst.
        if (noch > 0) {
          g.strokeStyle = "#fff1d6";
          g.lineWidth = Math.max(1.4, 1.7 * s);
          g.beginPath();
          g.arc(x, y, (TREFFER + 19 * Math.min(1.2, noch)) * s, 0, TAU);
          g.stroke();
        }
        // Das Ausrufezeichen.
        g.fillStyle = "#fff6e8";
        g.fillRect(x - 1.3 * s, y - 6 * s, 2.6 * s, 7.4 * s);
        g.fillRect(x - 1.3 * s, y + 3.2 * s, 2.6 * s, 2.6 * s);
        g.globalAlpha = 1;
      });
    }
  }

  // Die Biene, von oben: Kopf voraus in Flugrichtung (w im Bogenmass, im
  // Bild). geist: aus Licht, in dieser Farbe.
  function zeichneBiene(x, y, w, mass, wahl = {}) {
    const s = view.s * mass;
    const geist = wahl.geist || null;
    const t = ruhig() ? 0 : state.zeit;
    if (!geist && !wahl.ohneSchatten) {
      // Der Schatten auf dem Gras – sie fliegt eine Handbreit darüber.
      g.fillStyle = "rgba(10, 40, 18, 0.36)";
      g.beginPath();
      g.ellipse(x + 5 * view.s, y + 8 * view.s, 9.5 * s, 6 * s, w, 0, TAU);
      g.fill();
    }
    g.save();
    g.translate(x, y);
    g.rotate(w + (wahl.dreh || 0));
    g.scale(s, s);
    g.globalAlpha = wahl.alpha ?? 1;
    // Die Flügel: zwei Paar, sie schwirren.
    const schlag = ruhig() ? 0.2 : Math.sin(t * 75) * 0.34;
    g.fillStyle = geist ? geist : "rgba(240, 250, 255, 0.62)";
    if (geist) g.globalAlpha = (wahl.alpha ?? 1) * 0.5;
    [-1, 1].forEach((seite) => {
      g.save();
      g.translate(0.5, seite * 3.2);
      g.rotate(seite * (0.95 + schlag));
      g.beginPath();
      g.ellipse(-1.5, seite * 5.4, 3.7, 7.2, 0, 0, TAU);
      g.fill();
      g.rotate(seite * 0.5);
      g.beginPath();
      g.ellipse(-2.5, seite * 3.9, 2.5, 5, 0, 0, TAU);
      g.fill();
      g.restore();
    });
    g.globalAlpha = wahl.alpha ?? 1;
    // Der Hinterleib: golden, dunkle Streifen.
    g.fillStyle = geist || "#ffc21c";
    g.beginPath();
    g.ellipse(-4.6, 0, 7.4, 5.6, 0, 0, TAU);
    g.fill();
    if (!geist) {
      g.strokeStyle = "#2b1a08";
      g.lineCap = "butt";
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(-3.2, -5.3); g.quadraticCurveTo(-2.3, 0, -3.2, 5.3);
      g.moveTo(-7, -4.6); g.quadraticCurveTo(-6.1, 0, -7, 4.6);
      g.stroke();
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(-10.2, -2.8); g.quadraticCurveTo(-9.6, 0, -10.2, 2.8);
      g.stroke();
      // Glanz.
      g.fillStyle = "rgba(255, 244, 190, 0.6)";
      g.beginPath();
      g.ellipse(-5, -2.6, 4.2, 1.4, 0.1, 0, TAU);
      g.fill();
    }
    // Die Brust: flaumig, bernsteinfarben.
    g.fillStyle = geist || "#b9730e";
    g.beginPath();
    g.arc(2.6, 0, 4.7, 0, TAU);
    g.fill();
    if (!geist) {
      g.fillStyle = "#e9a52a";
      g.beginPath();
      g.arc(2, -1.2, 2.8, 0, TAU);
      g.fill();
    }
    // Der Kopf mit Augen und Fühlern.
    g.fillStyle = geist || "#2b1a08";
    g.beginPath();
    g.arc(7.6, 0, 3.4, 0, TAU);
    g.fill();
    if (!geist) {
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(8.7, -1.9, 1.1, 0, TAU);
      g.arc(8.7, 1.9, 1.1, 0, TAU);
      g.fill();
      g.strokeStyle = "#2b1a08";
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(9.8, -1.4); g.quadraticCurveTo(12.6, -2.4, 13.4, -4.4);
      g.moveTo(9.8, 1.4); g.quadraticCurveTo(12.6, 2.4, 13.4, 4.4);
      g.stroke();
    }
    g.restore();
    g.globalAlpha = 1;
  }

  // Die Wespe: schlank, dunkel, mit Streifen in Warnrot – und ihr Stachel.
  function zeichneWespe(x, y, w, saat) {
    const s = view.s;
    const t = ruhig() ? 0 : state.zeit;
    g.fillStyle = "rgba(10, 34, 16, 0.4)";
    g.beginPath();
    g.ellipse(x + 6 * s, y + 9 * s, 13 * s, 4.6 * s, w, 0, TAU);
    g.fill();
    schein("warn", x, y, 1.15, 0.9);
    g.save();
    g.translate(x, y);
    g.rotate(w);
    g.scale(s * 1.12, s * 1.12);
    const schlag = ruhig() ? 0.2 : Math.sin(t * 90 + saat * 7) * 0.3;
    g.fillStyle = "rgba(255, 230, 215, 0.5)";
    [-1, 1].forEach((seite) => {
      g.save();
      g.translate(2.5, seite * 2);
      g.rotate(seite * (0.62 + schlag));
      g.beginPath();
      g.ellipse(-3, seite * 6.4, 2.7, 8.6, 0, 0, TAU);
      g.fill();
      g.restore();
    });
    // Der Hinterleib: lang, spitz, mit Stachel.
    g.fillStyle = "#1a0d0a";
    g.beginPath();
    g.moveTo(-1.5, -3.6);
    g.quadraticCurveTo(-9, -4.6, -15.5, 0);
    g.quadraticCurveTo(-9, 4.6, -1.5, 3.6);
    g.closePath();
    g.fill();
    g.strokeStyle = "#1a0d0a";
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-15, 0);
    g.lineTo(-18.6, 0);
    g.stroke();
    g.strokeStyle = "#ff4a1c";
    g.lineCap = "butt";
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(-4.2, -3.7); g.lineTo(-4.2, 3.7);
    g.moveTo(-7.6, -3.5); g.lineTo(-7.6, 3.5);
    g.moveTo(-10.9, -2.6); g.lineTo(-10.9, 2.6);
    g.stroke();
    g.strokeStyle = "#ffb11c";
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(-5.7, -3.6); g.lineTo(-5.7, 3.6);
    g.moveTo(-9.1, -3.1); g.lineTo(-9.1, 3.1);
    g.stroke();
    // Die Taille, die Brust, der Kopf.
    g.fillStyle = "#1a0d0a";
    g.beginPath();
    g.ellipse(1.8, 0, 4.2, 3.3, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#ff4a1c";
    g.fillRect(0.2, -3, 1.2, 6);
    g.fillStyle = "#1a0d0a";
    g.beginPath();
    g.arc(7.2, 0, 3.1, 0, TAU);
    g.fill();
    g.fillStyle = "#ff2a1a";
    g.beginPath();
    g.arc(8.3, -1.8, 1.25, 0, TAU);
    g.arc(8.3, 1.8, 1.25, 0, TAU);
    g.fill();
    g.strokeStyle = "#1a0d0a";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(9.4, -1.2); g.lineTo(14, -3.6);
    g.moveTo(9.4, 1.2); g.lineTo(14, 3.6);
    g.stroke();
    g.restore();
  }

  function zeichneWespen() {
    const t = state.t;
    const rand = 60 / view.s;
    for (let i = state.wespen.length - 1; i >= 0; i -= 1) {
      const w = state.wespen[i];
      if (w.t2 < t - 3) break;
      if (t < w.ab) continue;
      const d = wespeWeg(w, t);
      const x = w.ex + w.ux * d;
      const y = w.ey + w.uy * d;
      const sx = bildX(x);
      const sy = bildY(y);
      if (sx < -rand || sy < -rand || sx > view.cssW + rand || sy > view.cssH + rand) continue;
      zeichneWespe(sx, sy, Math.atan2(w.uy, w.ux), w.saat);
    }
  }

  // Wohin die Biene schaut: längs der Bahn, in ihre Richtung.
  const blick = (a, dir) => a + dir * (Math.PI / 2);

  function zeichneSpur() {
    const n = state.spur.length;
    for (let i = 0; i < n; i += 1) {
      const p = state.spur[i];
      const k = (i + 1) / n;
      schein("spur", bildX(p.x), bildY(p.y), 0.35 + 0.75 * k, 0.75 * k * k);
    }
  }

  function zeichneFigur() {
    const b = state.biene;
    const s = view.s;
    let x = bildX(Math.cos(b.a) * R);
    let y = bildY(Math.sin(b.a) * R);
    const t = ruhig() ? 0 : state.zeit;
    if (state.schritt === "sturz" && state.sturz) {
      const f = state.sturz;
      x += f.x * s;
      y += f.y * s;
      zeichneBiene(x, y, blick(b.a, b.dir) + f.dreh, clamp(1.3 - f.zeit * 0.5, 0.75, 1.3), { ohneSchatten: f.zeit > 0.5 });
      return;
    }
    if (state.schritt === "start") {
      // Sie schwebt auf der Stelle – und ein Pfeil zeigt, wohin es losgeht.
      y += Math.sin(t * 3.2) * 1.6 * s;
      zeichneBiene(x, y, blick(b.a, b.dir), 1.3);
      g.fillStyle = "rgba(255, 255, 255, 0.85)";
      g.beginPath();
      for (let i = 1; i <= 5; i += 1) {
        const w = b.a + b.dir * (0.13 + i * 0.085);
        const r = (1.5 - i * 0.14 + 0.4 * Math.sin(t * 5 - i * 0.8)) * s;
        g.moveTo(bildX(Math.cos(w) * R) + r, bildY(Math.sin(w) * R));
        g.arc(bildX(Math.cos(w) * R), bildY(Math.sin(w) * R), Math.max(0.5, r), 0, TAU);
      }
      g.fill();
      return;
    }
    // In der Kehre dreht sie sich über aussen um.
    const kehre = ruhig() ? 0 : state.wende;
    zeichneBiene(x, y, blick(b.a, b.dir), 1.3, { dreh: -b.dir * Math.PI * glatt(kehre) });
  }

  // Die Gegner als Geist (geist.js): Bienen aus Licht.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    const namen = [];
    orte.forEach((o) => {
      if (o.ziel) return;
      const a = o.a / 200;
      const dir = (o.c & 1) ? 1 : -1;
      const sx = bildX(Math.cos(a) * (R + 9));
      const sy = bildY(Math.sin(a) * (R + 9));
      zeichneBiene(sx, sy, blick(a, dir), 1.05, { geist: o.farbe, alpha: 0.6 * o.blass });
      namen.push({ ...o, sx, sy: sy - 11 * view.s, weit: "" });
    });
    window.LernappGeist.namen(g, namen, { breit: view.cssW, hoch: view.cssH });
  }

  function zeichneTeile() {
    if (!state.teile.length) return;
    state.teile.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      g.fillStyle = t.farbe;
      const r = Math.max(0.7, t.r * view.s * (0.4 + 0.6 * k));
      g.fillRect(bildX(t.x) - r, bildY(t.y) - r, r * 2, r * 2);
    });
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    const b = state.biene;
    g.textAlign = "center";
    g.textBaseline = "middle";
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = Math.round(clamp(t.gross * view.s * 0.5, 13, 30));
      g.font = `900 ${gross}px system-ui, sans-serif`;
      const halb = g.measureText(t.text).width / 2 + 8;
      // Die Schrift steht innen neben der Biene, über der Blüte.
      const x = clamp(bildX(Math.cos(b.a) * R * 0.5), halb, view.cssW - halb);
      const y = bildY(Math.sin(b.a) * R * 0.5) - (1 - k) * 12 * view.s;
      g.globalAlpha = Math.min(1, k * 2.4);
      g.lineWidth = Math.max(3, gross * 0.22);
      g.strokeStyle = "rgba(40, 20, 0, 0.85)";
      g.strokeText(t.text, x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, x, y);
    });
    g.globalAlpha = 1;
  }

  function zeichnen() {
    if (!g || !wieseBild) return;
    const wackel = ruhig() ? 0 : Math.sin(state.zeit * 64) * 4 * state.stoss;
    // Die Wiese: auflegen, Punkt auf Punkt.
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.drawImage(wieseBild, Math.round(wackel * view.dpr), 0);
    g.setTransform(view.dpr, 0, 0, view.dpr, Math.round(wackel * view.dpr), 0);
    zeichneKraft();
    zeichneLuft();
    zeichneWarnung();
    zeichnePollen();
    zeichneGeister();
    zeichneSpur();
    zeichneFigur();
    zeichneWespen();
    zeichneTeile();
    zeichneSchriften();
    // Erwischt: ein kurzer roter Blitz. Ohne Kraft: Das Bild wird fahl.
    if (state.blitz > 0.01) {
      g.fillStyle = state.sturz?.warum === "kraft" ? `rgba(40, 50, 30, ${0.35 * state.blitz})` : `rgba(255, 60, 30, ${0.3 * state.blitz})`;
      g.fillRect(-10, 0, view.cssW + 20, view.cssH);
    }
  }

  // ---------------------------------------------------------------------------
  // Was aufstiebt
  // ---------------------------------------------------------------------------
  function teile(farbe, x, y, n, kraft) {
    if (ruhig()) return;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * TAU;
      const v = (14 + Math.random() * 46) * kraft;
      const leben = 0.3 + Math.random() * 0.45;
      state.teile.push({ farbe, x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 0.8 + Math.random() * 1, leben, max: leben });
    }
    if (state.teile.length > 120) state.teile.splice(0, state.teile.length - 120);
  }

  function schrift(text, farbe, gross) {
    state.schriften = [{ text, farbe, gross, leben: 0.85, max: 0.85 }];
  }

  // ---------------------------------------------------------------------------
  // Fliegen, umkehren, sammeln, erwischt werden
  // ---------------------------------------------------------------------------
  function kehre() {
    const b = state.biene;
    b.a0 = b.a;
    b.t0 = state.t;
    b.dir = -b.dir;
    state.kehren += 1;
    state.wende = 1;
    klang()?.ton?.("bienenflug.kehre", { laut: 0.55, hoehe: 1.15 + (b.dir > 0 ? 0.08 : 0) });
  }

  function sammle(p) {
    p.zustand = 1;
    state.punkte += 1;
    state.serie += 1;
    state.besteSerie = Math.max(state.besteSerie, state.serie);
    state.kraft = Math.min(1, state.kraft + GEWINN);
    shell.setCount(state.punkte);
    klang()?.ton?.("bienenflug.pollen", { hoehe: 0.9 + Math.min(14, state.serie) * 0.035 });
    teile("#ffe36b", Math.cos(p.a) * R, Math.sin(p.a) * R, 8, 1);
    if (state.serie > 0 && state.serie % 10 === 0) {
      klang()?.ton?.("bienenflug.serie", { hoehe: 1 + Math.min(5, state.serie / 10 - 1) * 0.06 });
      schrift(`Serie ${state.serie}!`, "#fff0a0", 40);
      kids()?.vibrate?.(10);
    }
  }

  function sturz(warum, nurBild = false) {
    if (state.schritt === "sturz") return;
    const b = state.biene;
    state.schritt = "sturz";
    state.sturz = { warum, zeit: 0, x: 0, y: 0, vx: -Math.sin(b.a) * b.dir * 30, vy: Math.cos(b.a) * b.dir * 30, dreh: 0, drehV: warum === "kraft" ? 2.5 : 13 };
    state.stoss = warum === "kraft" || warum === "ende" ? 0 : 1;
    state.blitz = warum === "ende" ? 0 : 1;
    klangAus();
    if (warum === "wespe") {
      klang()?.ton?.("bienenflug.stich");
      kids()?.vibrate?.([30, 40, 60]);
      teile("#ffd23d", Math.cos(b.a) * R, Math.sin(b.a) * R, 16, 1.5);
      teile("#ff5a36", Math.cos(b.a) * R, Math.sin(b.a) * R, 8, 1.2);
    } else if (warum === "kraft") {
      klang()?.ton?.("bienenflug.matt");
      kids()?.vibrate?.(40);
    }
    if (nurBild) return;
    stepTimer = window.setTimeout(finish, ruhig() ? 500 : ENDE_MS);
  }

  function sturzTakt(dt) {
    const f = state.sturz;
    if (!f) return;
    f.zeit += dt;
    f.vx *= 1 - 2.2 * dt;
    f.vy = f.vy * (1 - 2.2 * dt) + 60 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.dreh += f.drehV * dt;
    f.drehV *= 1 - 1.6 * dt;
  }

  // Pollen: sammeln, was die Biene berührt; verfallen lassen, was zu alt ist.
  function pollenTakt() {
    const t = state.t;
    const b = state.biene;
    for (let i = state.pollen.length - 1; i >= 0; i -= 1) {
      const p = state.pollen[i];
      if (p.bis < t - 2) break;
      if (p.zustand !== 0 || t < p.von) continue;
      if (t > p.bis) {
        p.zustand = 2;
        if (state.phase === "spiel") state.serie = 0;
        teile("#c9b98a", Math.cos(p.a) * R, Math.sin(p.a) * R, 4, 0.5);
        continue;
      }
      if (Math.abs(dreh(p.a - b.a)) < FANG) sammle(p);
    }
  }

  // Wespen: Ist eine der Biene zu nah? Und war eine haarscharf vorbei?
  function wespenTakt() {
    const t = state.t;
    const b = state.biene;
    const bx = Math.cos(b.a) * R;
    const by = Math.sin(b.a) * R;
    for (let i = state.wespen.length - 1; i >= 0; i -= 1) {
      const w = state.wespen[i];
      if (w.t2 < t - 1) break;
      if (t < w.t1 - 0.4 || t > w.t2 + 0.4) continue;
      const d = Math.hypot(wespeX(w, t) - bx, wespeY(w, t) - by);
      if (d < TREFFER) return w;
      if (d < w.nah) {
        w.nah = d;
      } else if (!w.knapp && w.nah < TREFFER + KNAPP && d > w.nah + 4) {
        // Sie ist vorbei – und war haarscharf dran.
        w.knapp = true;
        w.nah = Infinity;
        state.knappe += 1;
        klang()?.ton?.("bienenflug.knapp", { hoehe: 1 + Math.min(6, state.knappe - 1) * 0.04 });
        schrift("Haarscharf!", "#ffe08a", 40);
        teile("#fff3b0", bx, by, 9, 1);
        kids()?.vibrate?.(10);
      } else if (d > w.nah + 4) {
        w.nah = Infinity;
      }
    }
    return null;
  }

  function physik(dt) {
    const b = state.biene;
    const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
    const h = dt / n;
    for (let i = 0; i < n; i += 1) {
      if (state.schritt !== "flug") return;
      state.t += h;
      b.a = b.a0 + b.dir * (bogen(state.t) - bogen(b.t0));
      planBis(state.t);
      pollenTakt();
      if (wespenTakt()) {
        sturz("wespe");
        return;
      }
      // Der Nektar geht aus.
      state.kraft -= h / zehr(state.t);
      if (state.kraft <= 0) {
        state.kraft = 0;
        sturz("kraft");
        return;
      }
    }
  }

  // Der Tipp – zu der Zeit, zu der er geschah (jetzt, wie performance.now).
  function tippen(jetzt) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      losGehts();
      return;
    }
    if (state.phase !== "spiel" || state.schritt !== "flug") return;
    if (Number.isFinite(jetzt) && last) {
      const mehr = clamp((jetzt - last) / 1000 - voraus, 0, 0.05);
      if (mehr > 0) {
        physik(mehr);
        voraus += mehr;
      }
      if (state.schritt !== "flug") return;
    }
    kehre();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "flug";
    shell.setPhase("play");
    zuschauer.los();
    klangAn();
  }

  // Die Biene steht, wo die Aufzeichnung sie hat (a: der Winkel in
  // Zweihundertsteln, b: die Spielzeit in Hundertsteln, c: die Richtung) –
  // und Wespen und Pollen laufen nach derselben Uhr.
  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const b = state.biene;
    if (state.schritt !== "sturz") {
      const dir = (Math.round(s.c) & 1) ? 1 : -1;
      if (dir !== b.dir) { b.dir = dir; state.wende = 1; }
      b.a = s.a / 200;
      state.t = Math.max(state.t, s.b / 100);
      planBis(state.t);
      // Was sie berührt, verschwindet; gezählt wird nach der Aufzeichnung.
      const t = state.t;
      for (let i = state.pollen.length - 1; i >= 0; i -= 1) {
        const p = state.pollen[i];
        if (p.bis < t - 2) break;
        if (p.zustand !== 0 || t < p.von) continue;
        if (t > p.bis) p.zustand = 2;
        else if (Math.abs(dreh(p.a - b.a)) < FANG * 1.25) {
          p.zustand = 1;
          state.kraft = Math.min(1, state.kraft + GEWINN);
          teile("#ffe36b", Math.cos(p.a) * R, Math.sin(p.a) * R, 8, 1);
        }
      }
      state.kraft = Math.max(0.02, state.kraft - dt / zehr(t));
      const punkte = Math.max(0, Math.floor(s.punkte));
      if (punkte !== state.punkte) {
        state.punkte = punkte;
        shell.setCount(punkte);
      }
      klangStellen();
    }
    if (!zuschauer.weiter() && state.schritt !== "sturz") sturz("ende", true);
    if (state.schritt === "sturz") sturzTakt(dt);
  }

  // ---------------------------------------------------------------------------
  // Der Takt
  // ---------------------------------------------------------------------------
  function takt(dt, strecke = dt) {
    state.zeit += dt;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3.2);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * (state.sturz?.warum === "kraft" ? 0.4 : 2.6));
    if (state.wende > 0) state.wende = Math.max(0, state.wende - dt * 7.5);

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "sturz") {
      sturzTakt(dt);
    } else if (state.phase === "spiel") {
      if (strecke > 0) physik(strecke);
      klangStellen();
    }

    // Die Pollenspur hinter ihr: länger, je länger die Serie.
    const b = state.biene;
    if (state.schritt === "flug" && !ruhig()) {
      const x = Math.cos(b.a) * R;
      const y = Math.sin(b.a) * R;
      const letzte = state.spur[state.spur.length - 1];
      if (!letzte || Math.hypot(letzte.x - x, letzte.y - y) > 5) state.spur.push({ x, y });
      const lang = 7 + Math.min(9, Math.floor(state.serie / 3));
      if (state.spur.length > lang) state.spur.splice(0, state.spur.length - lang);
    } else if (state.spur.length && (state.schritt === "sturz" || ruhig())) {
      state.spur.shift();
    }

    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.vx *= 1 - 3 * dt;
      t.vy *= 1 - 3 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    if (state.phase === "spiel" && state.schritt === "flug") {
      gegner?.takt(state.punkte, { a: Math.round(b.a * 200), b: Math.round(state.t * 100), c: b.dir > 0 ? 1 : 0 });
    }
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const strecke = Math.max(0, dt - voraus);
    voraus = 0;
    messen();
    takt(dt, strecke);
    zeichnen();
  }

  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start. Die Biene fliegt los, die Uhr der Runde läuft.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "flug";
    shell.setPhase("play");
    gegner?.los();
    klangAn();
    kids()?.vibrate?.(8);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    klangAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "start";
    state.punkte = 0;
    state.t = 0;
    state.biene = { a: START_A, dir: 1, a0: START_A, t0: 0 };
    state.kraft = 1;
    state.kehren = 0;
    state.serie = 0;
    state.besteSerie = 0;
    state.knappe = 0;
    state.sturz = null;
    state.teile = [];
    state.schriften = [];
    state.spur = [];
    state.zeit = 0;
    state.stoss = 0;
    state.wende = 0;
    state.blitz = 0;
    rundeNeu();
    voraus = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt bf-prompt", "Tippen – die Biene kehrt um. Hol den Pollen, weich den Wespen aus!");
    shell.play.append(prompt, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 10);
    const start = performance.now();
    zahl.textContent = "0";
    const lauf = (now) => {
      if (!zahl.isConnected) return;
      const k = Math.min(1, (now - start) / dauer);
      zahl.textContent = String(Math.round(ziel * (1 - (1 - k) * (1 - k))));
      if (k < 1) window.requestAnimationFrame(lauf);
    };
    window.requestAnimationFrame(lauf);
  }

  const WARUM = { wespe: "Von einer Wespe erwischt", kraft: "Der Nektar ging aus" };

  function finish() {
    clearStep();
    stopLoop();
    klangAus();
    if (state.phase === "ende") return;
    state.phase = "ende";
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const warum = WARUM[state.sturz?.warum] || "";
    const sekunden = `${Math.round(state.t)} s`;
    shell.showResult({
      label: "Dein Pollen",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : `${warum ? `${warum} · ` : ""}${sekunden} · beste Serie ${state.besteSerie} · ${state.knappe} haarscharf`,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("bf-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Bienenflug",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "beeFlight", fassung: "t1", zufall, einheit: "Pollen", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "beeFlight", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Ein Tipp irgendwo aufs Bild: Sie kehrt um. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const t = Math.abs(performance.now() - event.timeStamp) < 250 ? event.timeStamp : performance.now();
    tippen(t);
  });

  const TASTEN = new Set([" ", "Enter"]);
  document.addEventListener("keydown", (event) => {
    if (!TASTEN.has(event.key)) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    tippen(performance.now());
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  // Für die Prüfskripte und die Vorführung.
  window.LernappBienenflug = {
    R, TREFFER, KNAPP, FANG, EINSTIEG, E_MIN, state, view,
    takt, tippen, losGehts, physik, planBis, planWinkel, stueckBei, kursText, omega, bogen, luft, band, zehr, vorwarn,
  };
})();
