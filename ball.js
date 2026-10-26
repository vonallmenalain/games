/*
 * ball.js – Ball hochhalten.
 * ---------------------------------------------------------------------------
 * Auf dem Bolzplatz fällt ein Fussball. Wer ihn antippt, kickt ihn wieder
 * hoch – und WO man ihn trifft, bestimmt die Richtung: links von der Mitte
 * getroffen, fliegt er nach rechts oben; rechts getroffen, nach links oben;
 * genau mittig, gerade hoch. Je weiter aussen der Tipp, desto schräger der
 * Kick und desto mehr Drall. Ein Tipp neben den Ball ist ein Luftloch: Er
 * zählt nicht, und eine Viertelsekunde lang zählt auch kein weiterer Tipp –
 * wildes Tippen hilft nicht. Schlägt der Ball auf dem Rasen auf, ist die
 * Runde vorbei. Mit der Tastatur kickt ← nach links, → nach rechts, ↑ oder
 * die Leertaste gerade hoch – aber nur, wenn der Ball unten am Fuss ist.
 *
 * Gezählt werden die Kontakte. Dazu kommen Bonuspunkte: Ein sehr mittiger
 * Treffer ist «Perfekt» (+1, ab dem fünften in Folge +2), und ab und zu
 * hängt ein Zielring in der Luft – wer den Ball hindurchkickt, bekommt +3.
 * Die Serie reisst bei jedem Treffer, der nicht perfekt ist.
 *
 * Schwerer wird es mit jedem Kontakt, nicht mit der Uhr: Die Schwerkraft
 * nimmt zu (der Ball fällt schneller, man muss schneller entscheiden), der
 * Ball wird etwas kleiner, ab 15 Kontakten kommen Böen (die Eckfahne dreht
 * sich und Blätter fliegen, bevor es bläst), ab 25 Tauben, an denen der Ball
 * abprallt, und ab 40 Schranken, die aus den Masten in den Platz klappen.
 * Links und rechts stehen die Flutlichtmasten: Daran prallt der Ball ab.
 * Oben spannt sich zwischen ihnen ein Netz wie über einem Bolzplatz-Käfig:
 * Höher fliegt der Ball nie, er bleibt immer im Bild. Ein Kick schickt ihn
 * hinauf bis APEX, mindestens aber um HUB_MIN – wer ihn hoch oben noch
 * einmal kickt, schlägt ihn ans Netz, und er kommt schnell zurück. Den Ball
 * oben mit kleinen Hüpfern zu halten, geht also nicht.
 * Mit den Kontakten wird es Abend, und irgendwann geht das Flutlicht an.
 *
 * Die Welt – Ringe, Böen, Tauben, Schranken – ist ein Plan nach Kontakten,
 * gewürfelt aus dem Zufall (zufall.js) in festen Blöcken zu zehn Kontakten:
 * ohne Turnier jedes Mal anders, im Turnier für alle im selben Versuch
 * derselbe. Gerechnet wird in Welteinheiten, y zählt nach oben, der Rasen
 * liegt bei 0, die Mitte des Platzes bei x = 0. Der Platz ist überall gleich
 * gross (FELD_HALB, OBEN): Hochkant steht mehr Himmel darüber, quer mehr
 * Platz daneben – schwerer oder leichter wird es dadurch nicht.
 *
 * Die Gegner (geist.js) spielen als halb durchsichtige Bälle mit – so, wie
 * sie in ihrer besten Runde gespielt haben (a = x, b = Höhe, c = Kontakte
 * mal 100 plus die Serie). Und die besten Runden lassen sich anschauen
 * (?zuschauen=, geist.js): mit derselben Saat, also mit denselben Ringen,
 * Böen und Tauben.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "keepy") return;

  const host = document.querySelector("#bh-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());
  const klang = () => window.ArcadeKlang || null;

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier bekommt jeder im selben Versuch denselben Plan. Nur der Plan
  // zieht daraus – Staub, Funken und Blätter würfeln Math.random oder hängen
  // an einer festen Zahl, damit der Plan nicht davon abhängt, wie jemand
  // spielt.
  const zufall = window.LernappZufall?.fuer?.("keepyUppy") || {
    neu() {},
    zahl: () => Math.random(),
  };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  const FELD_HALB = 120;           // zwischen den Masten: x von -120 bis 120
  const MAST_B = 9;                // so dick sind die Masten (aussen am Feld)
  const BODEN = 34;                // so viel Rasen steht unter der Bodenlinie im Bild
  const OBEN = 382;                // so hoch reicht der Platz, der immer im Bild steht
  const SICHT_W = 2 * (FELD_HALB + MAST_B + 10);
  const SICHT_H = OBEN + BODEN;
  const HORIZONT = 96;             // dort endet der Platz hinten, und der Zaun beginnt
  const TAKT = 1 / 240;            // gerechnet wird in festen kleinen Schritten

  // Der Kick. Er schickt den Ball hinauf bis APEX – von weiter oben
  // getroffen, wenigstens um HUB_MIN. Darüber hängt das Netz (DACH): Dort
  // prallt er ab und verliert viel Schwung.
  const APEX = 285;
  const HUB_MIN = 150;
  const DACH = 372;
  const DACH_PRALL = 0.35;
  const SPERRE = 0.2;              // so lange nach einem Kick zählt kein zweiter
  const LUFT_SPERRE = 0.25;        // so lange nach einem Luftloch zählt kein Tipp: Der Fuss muss erst zurück
  const PERFEKT = 0.2;             // so nah an der Mitte (Anteil des Radius) ist ein Treffer perfekt

  // Schwerkraft, Ballgrösse und Seitentempo – alles nach Kontakten. Die
  // Schwerkraft wächst erst schnell, dann stetig weiter, ohne Deckel. Das
  // Seitentempo wächst mit der Wurzel der Schwerkraft: Dann fliegt ein
  // schräger Kick bei jeder Schwerkraft gleich weit zur Seite.
  const G0 = 470;
  const G_DAZU = 760;
  const G_WEG = 32;
  const G_JE = 2.5;                // und danach immer weiter, je Kontakt
  const R0 = 18;
  const R_MIN = 11;
  const R_WEG = 45;
  const VX0 = 125;
  const DRALL = 16;                // so schnell dreht ein ganz aussen getroffener Ball (rad/s)

  // Was im Plan steht, und ab wann.
  const BLOCK = 10;                // Kontakte je Block
  const ZAHLEN_JE_BLOCK = 20;      // so viele Zufallszahlen zieht jeder Block, immer gleich viele
  const RING_AB = 4;
  const RING_DAUER = 5;            // so viele Kontakte lang hängt ein Ring
  const WIND_AB = 15;
  const VORWARNUNG = 1.1;          // so lange dreht die Fahne, bevor die Böe kommt (s)
  const WIND_MAX = 240;            // stärker drückt der Wind nie, auch wenn zwei Böen zusammenkommen
  const VOGEL_AB = 25;
  const BALKEN_AB = 40;
  const BALKEN_DAUER = 6;
  const BALKEN_DICK = 9;
  const BALKEN_NEIG = 0.18;        // die Schranke fällt zur Mitte hin ab – nichts bleibt darauf liegen
  const VOGEL_R = 10;

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.ball", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const gBei = (k) => G0 + G_DAZU * (1 - Math.exp(-k / G_WEG)) + G_JE * k;
  const rBei = (k) => R_MIN + (R0 - R_MIN) * Math.exp(-k / R_WEG);
  const vxBei = (k) => VX0 * Math.sqrt(gBei(k) / G0);
  // Wie stark eine Böe drückt (Einheiten je s²): anfangs sanft, dann mehr.
  const windBei = (k) => lerp(70, 215, 1 - Math.exp(-Math.max(0, k - WIND_AB) / 50));
  // Wie viel vom Schweren schon da ist – für Ringe, Tauben und Schranken.
  const schwereBei = (k) => 1 - Math.exp(-k / 60);

  // Immer dieselbe Zahl zu derselben Eingabe: Grashalme, Sterne und Fenster
  // stehen bei jedem Bild am selben Platz, ohne den Zufall anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase:   "bereit" (noch nichts getippt), "spiel", "zuschauen", "ende"
  // schritt: "warten", "flug", "aus" (der Ball liegt auf dem Rasen)
  const state = {
    phase: "bereit",
    schritt: "warten",
    punkte: 0,            // Kontakte und Bonus zusammen – die Zahl der Runde
    kontakte: 0,
    bonus: 0,
    combo: 0,
    besteCombo: 0,
    ringe: 0,             // so viele Ringe getroffen
    ball: { x: 0, y: 200, vx: 0, vy: 0, w: 0, dreh: 0, r: R0, quetsch: 0, quetschW: 0 },
    netz: { x: 0, t: -9, staerke: 0 },  // wo der Ball zuletzt ans Netz schlug
    schwebeY: 200,
    plan: { bloecke: 0, ringe: [], boeen: [], voegel: [], balken: [] },
    wind: { ax: 0, warn: 0, wirkt: 0, dir: 0 },
    fahne: 0,
    tag: 0,               // 0 Nachmittag, 1 Abend, 2 Nacht – gleitend
    licht: 0,             // das Flutlicht, 0 aus bis 1 an
    lichtAn: -9,          // wann es anging (für das Flackern)
    letzterKick: -9,
    letzterTipp: { zeit: -9, traf: true },
    sperreBis: -9,        // bis dahin zählt nach einem Luftloch kein Tipp
    grund: "",
    ausZeit: 0,
    teile: [],
    wellen: [],
    schriften: [],
    blaetter: [],
    stoss: 0,
    blitz: 0,
    glanz: 0,
    lupe: 0,
    zeit: 0,
    echt: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js): wer als halb durchsichtiger Ball mitspielt.
  let gegner = null;
  // Wer eine Runde anschaut statt zu spielen (geist.js, zuschauer).
  let zuschauer = null;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, w: SICHT_W, h: SICHT_H, frei: 0, camX: 0, camY: -BODEN };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  // Ganz leise das Publikum am Bolzplatz, solange der Ball in der Luft ist –
  // bei einer Serie perfekter Kontakte etwas lauter. Beim Zuschauen wie
  // beim Spielen.
  let publikum = null;
  let publikumGestellt = -1e9;
  function publikumAn() {
    if (!publikum?.laeuft) publikum = klang()?.kulisse("ball.publikum") || null;
    publikum?.laut(0.6);
    publikumStellen(true);
  }
  function publikumAus() {
    publikum?.stop();
    publikum = null;
  }
  function publikumStellen(sofort = false) {
    if (!publikum?.laeuft) return;
    const jetzt = performance.now();
    if (!sofort && jetzt - publikumGestellt < 100) return;
    publikumGestellt = jetzt;
    publikum.setze(0.25 + 0.06 * Math.min(10, state.combo));
  }
  // Was dicht kommen kann (Kick um Kick, das Netz, wildes Tippen), klingt
  // höchstens alle 60 ms.
  const tonZuletzt = {};
  function tonMitPause(id, o) {
    const jetzt = performance.now();
    if (jetzt - (tonZuletzt[id] ?? -1e9) < 60) return false;
    tonZuletzt[id] = jetzt;
    klang()?.ton(id, o);
    return true;
  }
  // Ein Kontakt: der Kick, eher leise – er kommt oft. Dazu für einen
  // perfekten die Harfe (nur der erste in Folge – danach genügt der Kick).
  function kickKlang(perfekt, reihe = state.combo) {
    if (!tonMitPause("ball.kick", { laut: 0.65 })) return;
    if (perfekt && reihe < 2) klang()?.ton("perfekt", { laut: 0.7 });
  }

  // ---------------------------------------------------------------------------
  // Der Plan
  // ---------------------------------------------------------------------------
  /*
   * Was wann kommt, steht in einem Plan nach Kontakten. Er wird Block um
   * Block gewürfelt – je zehn Kontakte, und jeder Block zieht genau
   * ZAHLEN_JE_BLOCK Zahlen, auch wenn er sie nicht alle braucht. So hängt der
   * Plan nur an der Saat, nicht daran, wie weit jemand kommt oder wann
   * nachgewürfelt wird.
   *
   *   Ring     hängt von Kontakt ab bis ab + RING_DAUER (oder bis er
   *            getroffen ist), immer seitlich der Mitte – hindurch geht es
   *            nur mit einem gezielten schrägen Kick.
   *   Böe      beginnt beim Kontakt ab: erst dreht die Fahne (VORWARNUNG),
   *            dann bläst sie dauer Sekunden lang, an- und abschwellend.
   *   Taube    fliegt beim Kontakt ab von einer Seite los, quer über den
   *            Platz; wer sie trifft, prallt ab.
   *   Schranke klappt beim Kontakt ab aus einem Mast und bleibt
   *            BALKEN_DAUER Kontakte; auf der anderen Seite ist immer mehr
   *            als die Hälfte frei.
   */
  function neuerBlock() {
    const p = state.plan;
    const b = p.bloecke;
    const z = [];
    for (let i = 0; i < ZAHLEN_JE_BLOCK; i += 1) z.push(zufall.zahl());
    const von = b * BLOCK;
    const k = schwereBei(von + BLOCK / 2);

    // Ein Ring je Block, ab dem vierten Kontakt.
    const ringAb = Math.max(RING_AB, von + 1 + Math.floor(z[0] * 6));
    if (ringAb < von + BLOCK) {
      const seite = z[1] < 0.5 ? -1 : 1;
      p.ringe.push({
        ab: ringAb,
        bis: ringAb + RING_DAUER,
        x: seite * lerp(38, 82, z[2]),
        y: lerp(118, 232, z[3]),
        innen: lerp(31, 23, k) * lerp(0.94, 1.06, z[4]),
        t0: -1,
        getroffen: -1,
        sicht: 0,
      });
    }

    // Eine Böe je Block, ab 15 Kontakten; später manchmal eine zweite.
    const boe = (ab, zd, zs, zl) => {
      if (ab < WIND_AB || ab >= von + BLOCK) return;
      p.boeen.push({
        ab,
        dir: zd < 0.5 ? -1 : 1,
        staerke: windBei(ab) * lerp(0.75, 1, zs),
        dauer: lerp(1.4, 2.5, zl),
        t0: -1,
      });
    };
    boe(Math.max(WIND_AB, von + Math.floor(z[5] * 5)), z[6], z[7], z[8]);
    if (von >= 50 && z[9] < 0.5) boe(von + 5 + Math.floor(z[10] * 5), z[11], z[7], z[12]);

    // Eine Taube, ab 25 Kontakten, in sieben von zehn Blöcken.
    const vogelAb = von + Math.floor(z[13] * BLOCK);
    if (vogelAb >= VOGEL_AB && z[14] < 0.7) {
      p.voegel.push({
        ab: vogelAb,
        dir: z[15] < 0.5 ? -1 : 1,
        y: lerp(150, 255, z[16]),
        v: lerp(70, 115, k),
        t0: -1,
        getroffen: -1,
      });
    }

    // Eine Schranke, ab 40 Kontakten, in gut der Hälfte der Blöcke.
    const balkenAb = von + 1 + Math.floor(z[17] * 4);
    if (balkenAb >= BALKEN_AB && z[18] < 0.55) {
      p.balken.push({
        ab: balkenAb,
        bis: balkenAb + BALKEN_DAUER,
        seite: z[19] < 0.5 ? -1 : 1,
        y: lerp(150, 225, z[16]),
        lang: FELD_HALB * lerp(0.82, 1.02, z[12]),
        raus: 0,
      });
    }
    p.bloecke += 1;
  }

  function planBis(k) {
    while (state.plan.bloecke * BLOCK <= k + BLOCK) neuerBlock();
  }

  // Was beim Kontakt k neu beginnt: Ringe tauchen auf, Böen kündigen sich
  // an, Tauben fliegen los. Im Spiel und beim Zuschauen gleich.
  function kontaktBeginnt(k) {
    planBis(k);
    const p = state.plan;
    p.ringe.forEach((r) => { if (r.ab === k) r.t0 = state.zeit; });
    p.boeen.forEach((b) => { if (b.ab === k) b.t0 = state.zeit; });
    p.voegel.forEach((v) => { if (v.ab === k) v.t0 = state.zeit; });
  }

  // Die Böen, wie sie jetzt wirken: Druck zur Seite, wie sehr sie sich
  // ankündigen (warn) und wie sehr sie blasen (wirkt).
  function windLage() {
    const w = state.wind;
    w.ax = 0;
    w.warn = 0;
    w.wirkt = 0;
    for (const b of state.plan.boeen) {
      if (b.t0 < 0) continue;
      const t = state.zeit - b.t0 - VORWARNUNG;
      if (t > b.dauer) continue;
      w.dir = b.dir;
      if (t < 0) {
        w.warn = Math.max(w.warn, 1 + t / VORWARNUNG);
      } else {
        const s = Math.sin(Math.PI * t / b.dauer);
        w.wirkt = Math.max(w.wirkt, s * s);
        w.ax += b.dir * b.staerke * s * s;
      }
    }
    // Zwei Böen zugleich drücken nicht doppelt so stark.
    w.ax = clamp(w.ax, -WIND_MAX, WIND_MAX);
  }

  // Wo eine Taube gerade ist – oder null, wenn sie nicht (mehr) im Bild ist.
  const VOGEL_START = FELD_HALB + 70;
  function vogelOrt(v) {
    if (v.t0 < 0) return null;
    if (v.getroffen >= 0) {
      const t = state.zeit - v.getroffen;
      if (t > 1.6) return null;
      return { x: v.hx + v.dir * 50 * t, y: v.hy + 40 * t + 70 * t * t, t, weg: true };
    }
    const t = state.zeit - v.t0;
    const x = -v.dir * VOGEL_START + v.dir * v.v * t;
    if (Math.abs(x) > VOGEL_START + 5) return null;
    return { x, y: v.y + Math.sin(t * 2.6) * 7, t, weg: false };
  }

  // Die Schranke als Strecke vom Mast bis zu ihrer Spitze.
  function balkenStrecke(b) {
    const x0 = b.seite * FELD_HALB;
    const lang = b.lang * b.raus;
    return { x0, y0: b.y, x1: x0 - b.seite * lang, y1: b.y - lang * BALKEN_NEIG };
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  let tipp = null;
  let promptKnoten = null;

  function buildPlatz() {
    feld = shell.el("div", "bh-feld");
    canvas = document.createElement("canvas");
    canvas.className = "bh-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");

    // Der Hinweis vor dem ersten Tipp: ein Ring auf dem Ball, der sich füllt.
    tipp = shell.el("span", "bh-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "bh-tipp-fuell" },
    ].forEach((ring) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", String(ring.r));
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", ring.stroke);
      kreis.setAttribute("stroke-width", String(ring.w));
      if (ring.klasse) {
        kreis.setAttribute("class", ring.klasse);
        kreis.setAttribute("stroke-linecap", "round");
      }
      svg.append(kreis);
    });
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "6");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(punkt);
    tipp.append(svg);
    feld.append(tipp);
    return feld;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber der Platz steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const nutzH = cssH - frei;
    // Der ganze Platz – Masten, Rasen, bis OBEN – steht immer im Bild, gleich
    // gross in Welteinheiten. Was übrig ist, wird Himmel (hochkant) oder
    // Platz daneben (quer).
    view.s = Math.min(cssW / SICHT_W, nutzH / SICHT_H);
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    view.camX = -view.w / 2;
    view.camY = -BODEN;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Vor dem ersten Tipp schwebt der Ball dort, wo der Hinweisring steht:
    // in der Mitte der Fläche – nicht zu hoch, nicht zu tief.
    state.schwebeY = clamp(view.camY + (cssH / 2) / view.s, 130, 255);
    if (tipp) {
      // Der Ring liegt um den Ball, nicht darin.
      tipp.style.width = `${Math.round(Math.max(44, R0 * view.s * 3.9))}px`;
      tipp.style.left = `${Math.round(bildX(0))}px`;
      tipp.style.top = `${Math.round(bildY(state.schwebeY))}px`;
    }
    hintergruende.schluessel = "";
    ballBild.schluessel = "";
  }

  const wackelX = () => (ruhig() ? 0 : Math.cos(state.echt * 53) * 2.5 * state.stoss);
  const wackelY = () => (ruhig() ? 0 : Math.sin(state.echt * 71) * 4 * state.stoss);

  // Das Bild ohne Kamerastoss: für die Anzeige.
  function flachTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  // Das Bild mit Kamerastoss: für alles auf dem Platz.
  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, wackelX() * view.dpr, wackelY() * view.dpr);
  }

  const bildX = (x) => (x - view.camX) * view.s;
  const bildY = (y) => view.cssH - (y - view.camY) * view.s;
  const weltX = (sx) => sx / view.s + view.camX;
  const weltY = (sy) => (view.cssH - sy) / view.s + view.camY;

  // ---------------------------------------------------------------------------
  // Die gemalten Bilder im Speicher
  // ---------------------------------------------------------------------------
  /*
   * Der Platz steht still – nur der Ball, die Ringe, die Tauben und der Wind
   * bewegen sich. Himmel, Häuser, Zaun, Tor, Rasen und Masten liegen deshalb
   * fertig gemalt in einer Leinwand je Tageszeit (Nachmittag, Abend, Nacht
   * mit Flutlicht), genau so gross wie die Leinwand im Bild: Dann ist jedes
   * Bild nur ein Kopieren, ohne Skalieren. Gemalt wird eine erst, wenn sie
   * gebraucht wird, und höchstens zwei liegen im Speicher; beim Übergang
   * werden sie übereinander geblendet.
   */
  const hintergruende = { schluessel: "", bilder: [null, null, null] };
  const ballBild = { schluessel: "", muster: null, licht: null, groesse: 0 };

  const TAGESZEITEN = [
    {
      name: "nachmittag",
      himmel: ["#4f9fe0", "#8fc8ee", "#f3e6c4"],
      wolke: "rgba(255, 255, 255, 0.85)",
      fern: "#7fae8c", haus: "#c98d6a", dach: "#9c5a45", baum: "#4f8f5a",
      rasen: ["#5cb84a", "#4ea93f"], vorne: "#3f8f35", linie: "rgba(255, 255, 255, 0.8)",
      zaun: "rgba(60, 80, 70, 0.55)", mast: ["#c9d1d8", "#8995a1"],
    },
    {
      name: "abend",
      himmel: ["#2b2c6e", "#b44f7c", "#ffaa5e"],
      wolke: "rgba(255, 190, 170, 0.75)",
      fern: "#6a4f78", haus: "#7d4f63", dach: "#5a3448", baum: "#3f4f5c",
      rasen: ["#4c9a3e", "#408a36"], vorne: "#33722e", linie: "rgba(255, 240, 225, 0.75)",
      zaun: "rgba(40, 30, 60, 0.6)", mast: ["#b2a7b8", "#6c6178"],
    },
    {
      name: "nacht",
      himmel: ["#03051a", "#0d1440", "#242c5c"],
      wolke: "rgba(120, 130, 190, 0.35)",
      fern: "#141a3a", haus: "#1b2246", dach: "#121732", baum: "#0f1530",
      rasen: ["#3f9a3f", "#348a35"], vorne: "#24632a", linie: "rgba(255, 255, 255, 0.85)",
      zaun: "rgba(150, 170, 220, 0.35)", mast: ["#8d97b0", "#4c5570"],
    },
  ];

  function leinwand(w, h, q) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * q));
    c.height = Math.max(1, Math.ceil(h * q));
    const cg = c.getContext("2d");
    cg.scale(q, q);
    return { c, g: cg };
  }

  function hintergrund(i) {
    const schluessel = `${view.cssW}|${view.cssH}|${view.dpr}`;
    if (hintergruende.schluessel !== schluessel) {
      hintergruende.schluessel = schluessel;
      hintergruende.bilder = [null, null, null];
    }
    const bilder = hintergruende.bilder;
    if (!bilder[i]) {
      // Die am weitesten entfernte Tageszeit macht Platz.
      if (bilder.filter(Boolean).length >= 2) bilder[i === 0 ? 2 : i === 2 ? 0 : (state.tag > 1 ? 0 : 2)] = null;
      bilder[i] = maleHintergrund(i, view.dpr);
    }
    return bilder[i];
  }

  function maleHintergrund(i, q) {
    const T = TAGESZEITEN[i];
    const W = view.cssW;
    const H = view.cssH;
    const s = view.s;
    const { c, g: cg } = leinwand(W, H, q);
    if (c.width !== canvas.width || c.height !== canvas.height) {
      c.width = canvas.width;
      c.height = canvas.height;
      cg.scale(c.width / W, c.height / H);
    }
    const X = bildX;
    const Y = bildY;
    const nacht = i === 2;

    // Der Himmel.
    const hor = Y(HORIZONT);
    const himmel = cg.createLinearGradient(0, 0, 0, hor);
    himmel.addColorStop(0, T.himmel[0]);
    himmel.addColorStop(0.6, T.himmel[1]);
    himmel.addColorStop(1, T.himmel[2]);
    cg.fillStyle = himmel;
    cg.fillRect(0, 0, W, hor + 2);

    // Sonne, Abendsonne oder Mond – mit einem weichen Hof.
    const gestirn = (fx, fy, r, kern, hof) => {
      const x = W * fx;
      const y = Math.min(hor - r * 0.4, H * fy);
      const h = cg.createRadialGradient(x, y, r * 0.3, x, y, r * 4.5);
      h.addColorStop(0, hof);
      h.addColorStop(1, "rgba(0,0,0,0)");
      cg.fillStyle = h;
      cg.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
      cg.fillStyle = kern;
      cg.beginPath();
      cg.arc(x, y, r, 0, Math.PI * 2);
      cg.fill();
    };
    if (i === 0) gestirn(0.8, 0.16, 14 * s, "#fff6d8", "rgba(255, 236, 170, 0.45)");
    if (i === 1) gestirn(0.24, 0.9, 30 * s, "#ffd27a", "rgba(255, 150, 80, 0.5)");
    if (nacht) {
      cg.fillStyle = "#ffffff";
      for (let n = 0; n < 140; n += 1) {
        const x = hash01(n * 3.7 + 1) * W;
        const y = hash01(n * 5.3 + 2) * hor * 0.95;
        cg.globalAlpha = 0.25 + hash01(n * 9.1) * 0.65;
        cg.beginPath();
        cg.arc(x, y, 0.5 + hash01(n * 7.7) * 1.1, 0, Math.PI * 2);
        cg.fill();
      }
      cg.globalAlpha = 1;
      gestirn(0.2, 0.12, 11 * s, "#f4f1ff", "rgba(170, 180, 255, 0.25)");
      cg.fillStyle = T.himmel[1];
      cg.beginPath();
      cg.arc(W * 0.2 + 5 * s, Math.min(hor - 4 * s, H * 0.12) - 3 * s, 10 * s, 0, Math.PI * 2);
      cg.fill();
    }

    // Wolken: ein paar Bäusche aus Kreisen.
    cg.fillStyle = T.wolke;
    for (let n = 0; n < 6; n += 1) {
      const x = hash01(n * 11.3 + i) * W;
      const y = hash01(n * 4.1 + 3) * Math.max(20, hor - 120 * s) + 20;
      const r = (10 + hash01(n * 2.9) * 12) * s;
      for (let k = 0; k < 5; k += 1) {
        cg.beginPath();
        cg.ellipse(x + (k - 2) * r * 0.9, y + Math.abs(k - 2) * r * 0.18, r * (1.1 - Math.abs(k - 2) * 0.15), r * 0.7, 0, 0, Math.PI * 2);
        cg.fill();
      }
    }

    // Weit hinten: Hügel, Häuser und Bäume über dem Zaun.
    const zaunOben = HORIZONT + 20;
    cg.fillStyle = T.fern;
    cg.beginPath();
    cg.moveTo(0, hor);
    for (let x = 0; x <= W + 20; x += 20) {
      const wx = weltX(x);
      cg.lineTo(x, Y(zaunOben + 26 + Math.sin(wx * 0.011) * 14 + Math.sin(wx * 0.031 + 1) * 6));
    }
    cg.lineTo(W, hor);
    cg.closePath();
    cg.fill();
    const von = Math.floor(weltX(0) / 46) - 1;
    const bis = Math.ceil(weltX(W) / 46) + 1;
    for (let n = von; n <= bis; n += 1) {
      const h = (k) => hash01(n * 13.7 + k * 3.1);
      const x = n * 46 + h(1) * 16;
      if (h(2) < 0.55) {
        // Ein Haus mit Dach und Fenstern – nachts brennt in manchen Licht.
        const b = 26 + h(3) * 14;
        const hoch = 22 + h(4) * 26;
        const unten = zaunOben + 2;
        cg.fillStyle = T.haus;
        cg.fillRect(X(x), Y(unten + hoch), b * s, hoch * s);
        cg.fillStyle = T.dach;
        cg.beginPath();
        cg.moveTo(X(x - 3), Y(unten + hoch));
        cg.lineTo(X(x + b / 2), Y(unten + hoch + 12 + h(5) * 6));
        cg.lineTo(X(x + b + 3), Y(unten + hoch));
        cg.closePath();
        cg.fill();
        for (let fy = 0; fy < Math.floor(hoch / 12); fy += 1) {
          for (let fx = 0; fx < 2; fx += 1) {
            const an = hash01(n * 5.1 + fy * 1.7 + fx * 2.3) < (nacht ? 0.55 : i === 1 ? 0.3 : 0);
            cg.fillStyle = an ? "#ffd77a" : "rgba(20, 24, 40, 0.35)";
            cg.fillRect(X(x + 5 + fx * (b - 15)), Y(unten + hoch - 5 - fy * 12), 5 * s, 6 * s);
          }
        }
      } else {
        // Ein Baum: Stamm und drei Kugeln Laub.
        cg.fillStyle = T.dach;
        cg.fillRect(X(x + 9), Y(zaunOben + 14), 3 * s, 14 * s);
        cg.fillStyle = T.baum;
        [[10, 24, 11], [4, 18, 8], [17, 18, 8]].forEach(([dx, dy, r]) => {
          cg.beginPath();
          cg.arc(X(x + dx), Y(zaunOben + dy + h(6) * 8), r * s * (0.9 + h(7) * 0.3), 0, Math.PI * 2);
          cg.fill();
        });
      }
    }

    // Der Rasen bis zum Zaun, mit Mähstreifen: nach hinten immer schmaler.
    const boden = Y(0);
    cg.fillStyle = T.rasen[0];
    cg.fillRect(0, hor, W, boden - hor + 1);
    cg.fillStyle = T.rasen[1];
    let vor = 0;
    for (let n = 1; n < 14; n += 1) {
      const d = 1 + n * n * 0.22;
      const y = HORIZONT * (1 - 1 / d);
      if (n % 2 === 0) cg.fillRect(0, Y(y), W, (y - vor) * s + 0.5);
      vor = y;
    }
    // Ein Hauch Dunst am Horizont.
    const dunst = cg.createLinearGradient(0, hor, 0, hor + 30 * s);
    dunst.addColorStop(0, nacht ? "rgba(30, 40, 90, 0.5)" : "rgba(255, 240, 220, 0.35)");
    dunst.addColorStop(1, "rgba(0,0,0,0)");
    cg.fillStyle = dunst;
    cg.fillRect(0, hor, W, 30 * s);

    // Der Zaun hinten: Pfosten und ein Gitter.
    cg.strokeStyle = T.zaun;
    cg.lineWidth = Math.max(1, 0.5 * s);
    cg.beginPath();
    for (let x = Math.floor(weltX(0) / 8) * 8; x < weltX(W) + 8; x += 8) {
      cg.moveTo(X(x), Y(HORIZONT));
      cg.lineTo(X(x + 10), Y(zaunOben));
      cg.moveTo(X(x + 10), Y(HORIZONT));
      cg.lineTo(X(x), Y(zaunOben));
    }
    cg.stroke();
    cg.lineWidth = Math.max(1, 1.4 * s);
    cg.beginPath();
    cg.moveTo(0, Y(zaunOben));
    cg.lineTo(W, Y(zaunOben));
    for (let x = Math.floor(weltX(0) / 40) * 40; x < weltX(W) + 40; x += 40) {
      cg.moveTo(X(x), Y(HORIZONT));
      cg.lineTo(X(x), Y(zaunOben + 2));
    }
    cg.stroke();

    // Die Linien des Strafraums, schräg nach hinten, und das Tor dahinter.
    cg.strokeStyle = T.linie;
    cg.lineWidth = Math.max(1, 1.3 * s);
    cg.beginPath();
    cg.moveTo(X(-150), Y(62));
    cg.lineTo(X(-118), Y(26));
    cg.lineTo(X(118), Y(26));
    cg.lineTo(X(150), Y(62));
    cg.moveTo(X(-82), Y(62));
    cg.lineTo(X(-74), Y(48));
    cg.lineTo(X(74), Y(48));
    cg.lineTo(X(82), Y(62));
    cg.moveTo(X(-200), Y(62));
    cg.lineTo(X(200), Y(62));
    cg.stroke();
    const torL = -56;
    const torR = 56;
    const torU = 62;
    const torO = 100;
    cg.strokeStyle = nacht ? "rgba(200, 210, 255, 0.35)" : "rgba(255, 255, 255, 0.45)";
    cg.lineWidth = Math.max(1, 0.5 * s);
    cg.beginPath();
    for (let x = torL; x <= torR; x += 5) { cg.moveTo(X(x), Y(torO)); cg.lineTo(X(x * 0.92), Y(torU + 6)); }
    for (let y = torU + 6; y <= torO; y += 5) { cg.moveTo(X(torL * 0.92), Y(y)); cg.lineTo(X(torR * 0.92), Y(y)); }
    cg.stroke();
    cg.strokeStyle = "#ffffff";
    cg.lineWidth = Math.max(1.5, 2.6 * s);
    cg.lineCap = "round";
    cg.beginPath();
    cg.moveTo(X(torL), Y(torU));
    cg.lineTo(X(torL), Y(torO));
    cg.lineTo(X(torR), Y(torO));
    cg.lineTo(X(torR), Y(torU));
    cg.stroke();

    // Vorne: der dunklere Rasen unter der Bodenlinie, die Seitenlinie und
    // Grashalme an der Kante.
    cg.fillStyle = T.vorne;
    cg.fillRect(0, boden, W, H - boden + 2);
    cg.fillStyle = T.linie;
    cg.fillRect(0, Y(-5), W, Math.max(1.5, 2.2 * s));
    cg.strokeStyle = T.rasen[1];
    cg.lineWidth = Math.max(1, 0.9 * s);
    cg.beginPath();
    for (let x = 0; x < W; x += 3) {
      const h = hash01(x * 0.37 + 5);
      cg.moveTo(x, boden + 1);
      cg.lineTo(x + (h - 0.5) * 3, boden - (2 + h * 5) * s);
    }
    cg.stroke();
    const tief = cg.createLinearGradient(0, boden, 0, H);
    tief.addColorStop(0, "rgba(0,0,0,0)");
    tief.addColorStop(1, "rgba(0,0,0,0.28)");
    cg.fillStyle = tief;
    cg.fillRect(0, boden, W, H - boden);

    // Die Flutlichtmasten links und rechts – an ihnen prallt der Ball ab.
    // Unten ein Polster in Orange und Weiss, oben die Lampen.
    const mastOben = OBEN + 16;
    [-1, 1].forEach((seite) => {
      const mx = seite * (FELD_HALB + MAST_B / 2);
      const verlauf = cg.createLinearGradient(X(mx - MAST_B / 2), 0, X(mx + MAST_B / 2), 0);
      verlauf.addColorStop(0, T.mast[0]);
      verlauf.addColorStop(1, T.mast[1]);
      cg.fillStyle = verlauf;
      cg.fillRect(X(mx - MAST_B / 2 + 1.5), Y(mastOben), (MAST_B - 3) * s, (mastOben + 8) * s);
      for (let n = 0; n < 8; n += 1) {
        cg.fillStyle = n % 2 ? "#ffffff" : "#f5a623";
        cg.fillRect(X(mx - MAST_B / 2), Y(16 + (n + 1) * 18), MAST_B * s, 18 * s);
      }
      cg.fillStyle = "rgba(0, 0, 0, 0.18)";
      cg.fillRect(X(mx + seite * (MAST_B / 2 - 2.5) - 1.25), Y(160), 2.5 * s, 160 * s);
      // Der Kopf mit sechs Lampen, zum Platz hin geneigt.
      cg.save();
      cg.translate(X(mx), Y(mastOben));
      cg.rotate(-seite * 0.18);
      cg.fillStyle = T.mast[1];
      cg.fillRect(-20 * s, -16 * s, 40 * s, 18 * s);
      for (let n = 0; n < 6; n += 1) {
        const lx = (-15 + (n % 3) * 15) * s;
        const ly = (-11 + Math.floor(n / 3) * 8) * s;
        cg.fillStyle = nacht ? "#fffbe6" : "#dfe6ee";
        cg.beginPath();
        cg.arc(lx, ly, 3.2 * s, 0, Math.PI * 2);
        cg.fill();
      }
      cg.restore();
    });

    // Das Netz oben zwischen den Masten: ein Gitter, schräg nach hinten
    // gespannt. Das Seil davor zeichnet zeichneNetz – es gibt nach, wenn der
    // Ball anschlägt.
    cg.strokeStyle = nacht ? "rgba(190, 200, 235, 0.35)" : "rgba(255, 255, 255, 0.4)";
    cg.lineWidth = Math.max(0.8, 0.6 * s);
    cg.beginPath();
    for (let x = -FELD_HALB; x <= FELD_HALB; x += 10) {
      cg.moveTo(X(x), Y(DACH));
      cg.lineTo(X(x * 0.9 + 6), Y(DACH + 22));
      cg.moveTo(X(x), Y(DACH));
      cg.lineTo(X(x * 0.9 - 6), Y(DACH + 22));
    }
    for (let y = DACH + 7; y <= DACH + 22; y += 7) {
      const k = 1 - ((y - DACH) / 22) * 0.1;
      cg.moveTo(X(-FELD_HALB * k), Y(y));
      cg.lineTo(X(FELD_HALB * k), Y(y));
    }
    cg.stroke();

    // Nachts: das Licht der Lampen – ein Hof um den Kopf und ein heller
    // Kegel auf den Rasen, zusammengezählt («lighter»).
    if (nacht) {
      cg.globalCompositeOperation = "lighter";
      [-1, 1].forEach((seite) => {
        const lx = X(seite * (FELD_HALB + MAST_B / 2));
        const ly = Y(mastOben + 4);
        const hof = cg.createRadialGradient(lx, ly, 2, lx, ly, 70 * s);
        hof.addColorStop(0, "rgba(255, 250, 220, 0.75)");
        hof.addColorStop(1, "rgba(255, 250, 220, 0)");
        cg.fillStyle = hof;
        cg.fillRect(lx - 70 * s, ly - 70 * s, 140 * s, 140 * s);
        const kegel = cg.createLinearGradient(0, ly, 0, boden);
        kegel.addColorStop(0, "rgba(255, 250, 225, 0.16)");
        kegel.addColorStop(1, "rgba(255, 250, 225, 0.03)");
        cg.fillStyle = kegel;
        cg.beginPath();
        cg.moveTo(lx - 12 * s, ly);
        cg.lineTo(lx + 12 * s, ly);
        cg.lineTo(X(-seite * 40), boden);
        cg.lineTo(X(seite * (FELD_HALB + 40)), boden);
        cg.closePath();
        cg.fill();
      });
      const rasenLicht = cg.createRadialGradient(X(0), Y(20), 10 * s, X(0), Y(20), 220 * s);
      rasenLicht.addColorStop(0, "rgba(200, 255, 190, 0.16)");
      rasenLicht.addColorStop(1, "rgba(200, 255, 190, 0)");
      cg.fillStyle = rasenLicht;
      cg.fillRect(0, hor, W, H - hor);
      cg.globalCompositeOperation = "source-over";
    }
    return c;
  }

  // Der Ball: das Muster (dreht sich mit) und Licht und Schatten darüber
  // (dreht sich nicht) – beide fertig gemalt, in der Grösse R0.
  function baueBall() {
    const schluessel = `${view.s}|${view.dpr}`;
    if (ballBild.schluessel === schluessel) return;
    ballBild.schluessel = schluessel;
    const q = view.dpr;
    const R = R0 * view.s;
    const D = Math.ceil(R * 2 + 4);
    ballBild.groesse = D;

    const muster = leinwand(D, D, q);
    let cg = muster.g;
    cg.translate(D / 2, D / 2);
    cg.beginPath();
    cg.arc(0, 0, R, 0, Math.PI * 2);
    cg.fillStyle = "#fbfbf7";
    cg.fill();
    cg.save();
    cg.clip();
    const fuenfeck = (cx, cy, r, w) => {
      cg.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const a = w + (k * Math.PI * 2) / 5;
        if (k) cg.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        else cg.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      cg.closePath();
      cg.fill();
    };
    cg.fillStyle = "#1d1f2b";
    fuenfeck(0, 0, R * 0.36, -Math.PI / 2);
    cg.strokeStyle = "rgba(40, 44, 60, 0.55)";
    cg.lineWidth = Math.max(0.8, R * 0.05);
    for (let k = 0; k < 5; k += 1) {
      const a = -Math.PI / 2 + (k * Math.PI * 2) / 5;
      const b = a + Math.PI / 5;
      fuenfeck(Math.cos(b) * R * 0.98, Math.sin(b) * R * 0.98, R * 0.36, b);
      cg.beginPath();
      cg.moveTo(Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36);
      cg.lineTo(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72);
      cg.lineTo(Math.cos(a + 0.42) * R * 0.86, Math.sin(a + 0.42) * R * 0.86);
      cg.moveTo(Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72);
      cg.lineTo(Math.cos(a - 0.42) * R * 0.86, Math.sin(a - 0.42) * R * 0.86);
      cg.stroke();
    }
    cg.restore();
    ballBild.muster = muster.c;

    const licht = leinwand(D, D, q);
    cg = licht.g;
    cg.translate(D / 2, D / 2);
    const schatten = cg.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.2, 0, 0, R);
    schatten.addColorStop(0, "rgba(0, 0, 0, 0)");
    schatten.addColorStop(0.65, "rgba(0, 0, 0, 0.05)");
    schatten.addColorStop(1, "rgba(10, 20, 40, 0.42)");
    cg.fillStyle = schatten;
    cg.beginPath();
    cg.arc(0, 0, R, 0, Math.PI * 2);
    cg.fill();
    const glanz = cg.createRadialGradient(-R * 0.38, -R * 0.42, 0, -R * 0.38, -R * 0.42, R * 0.55);
    glanz.addColorStop(0, "rgba(255, 255, 255, 0.85)");
    glanz.addColorStop(1, "rgba(255, 255, 255, 0)");
    cg.fillStyle = glanz;
    cg.beginPath();
    cg.arc(0, 0, R, 0, Math.PI * 2);
    cg.fill();
    cg.strokeStyle = "rgba(20, 24, 40, 0.55)";
    cg.lineWidth = Math.max(1, R * 0.06);
    cg.beginPath();
    cg.arc(0, 0, R - cg.lineWidth / 2, 0, Math.PI * 2);
    cg.stroke();
    ballBild.licht = licht.c;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  function zeichneHintergrund() {
    // Ganze Bildpunkte, kein Skalieren: nur Kopieren.
    g.setTransform(1, 0, 0, 1, 0, 0);
    const dx = Math.round(wackelX() * view.dpr);
    const dy = Math.round(wackelY() * view.dpr);
    const a = Math.min(2, Math.floor(state.tag));
    const f = state.tag - a;
    // Unter dem Kamerastoss blitzt kein leerer Rand hervor.
    if (dx || dy) {
      g.fillStyle = TAGESZEITEN[a].vorne;
      g.fillRect(0, 0, canvas.width, canvas.height);
    }
    g.drawImage(hintergrund(a), dx, dy);
    if (f > 0.004 && a < 2) {
      g.globalAlpha = f;
      g.drawImage(hintergrund(a + 1), dx, dy);
      g.globalAlpha = 1;
    }
  }

  // Das Flutlicht geht an: Es flackert kurz, dann steht es.
  function zeichneFlutlicht() {
    const t = state.echt - state.lichtAn;
    if (t < 0 || t > 1.4) return;
    const flacker = t < 0.9 ? (Math.sin(t * 60) > 0.2 ? 1 : 0.15) : 1 - (t - 0.9) / 0.5;
    if (flacker <= 0) return;
    bildTransform();
    g.globalCompositeOperation = "lighter";
    [-1, 1].forEach((seite) => {
      const lx = bildX(seite * (FELD_HALB + MAST_B / 2));
      const ly = bildY(OBEN + 20);
      const r = 90 * view.s;
      const hof = g.createRadialGradient(lx, ly, 2, lx, ly, r);
      hof.addColorStop(0, `rgba(255, 250, 220, ${0.8 * flacker})`);
      hof.addColorStop(1, "rgba(255, 250, 220, 0)");
      g.fillStyle = hof;
      g.fillRect(lx - r, ly - r, r * 2, r * 2);
    });
    g.globalCompositeOperation = "source-over";
  }

  // Die Eckfahne vorne im Rasen, unter der Bodenlinie – nicht im Weg: Sie
  // hängt, flattert im Wind und zeigt, woher die nächste Böe kommt.
  function zeichneFahne() {
    bildTransform();
    const s = view.s;
    const fx = bildX(-FELD_HALB + 16);
    const fu = bildY(-BODEN + 4);
    const fo = bildY(-9);
    g.strokeStyle = "#f2f2f2";
    g.lineWidth = Math.max(1.5, 1.8 * s);
    g.beginPath();
    g.moveTo(fx, fu);
    g.lineTo(fx, fo);
    g.stroke();
    // Ohne Wind hängt sie fast, im Wind steht sie waagrecht in seine Richtung.
    const f = clamp(state.fahne, -1, 1);
    const lang = 15 * s;
    const welle = Math.sin(state.echt * (5 + Math.abs(f) * 12)) * (0.08 + Math.abs(f) * 0.18);
    const a = (f >= 0 ? (Math.PI / 2) * (1 - f) : Math.PI / 2 - (Math.PI / 2) * f) + welle;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    g.fillStyle = state.wind.warn > 0 || state.wind.wirkt > 0.05 ? "#ffcf3f" : "#f5a623";
    g.beginPath();
    g.moveTo(fx, fo);
    g.quadraticCurveTo(fx + dx * lang * 0.5 - dy * 3 * s * welle * 4, fo + dy * lang * 0.5 + dx * 3 * s * welle * 4, fx + dx * lang, fo + dy * lang + 4 * s);
    g.lineTo(fx, fo + 9 * s);
    g.closePath();
    g.fill();
  }

  // Das Seil vorne am Netz: Wo der Ball anschlägt, beult es sich aus.
  function zeichneNetz() {
    bildTransform();
    const s = view.s;
    const n = state.netz;
    const u = clamp((state.zeit - n.t) / 0.45, 0, 1);
    const beule = u < 1 ? Math.sin(u * Math.PI) * (1 - u) * 14 * n.staerke : 0;
    g.strokeStyle = "#f4f6f8";
    g.lineWidth = Math.max(1.5, 2 * s);
    g.beginPath();
    g.moveTo(bildX(-FELD_HALB), bildY(DACH));
    if (beule > 0.2) {
      const x = clamp(n.x, -FELD_HALB + 30, FELD_HALB - 30);
      g.lineTo(bildX(x - 34), bildY(DACH));
      g.quadraticCurveTo(bildX(x), bildY(DACH + beule * 2), bildX(x + 34), bildY(DACH));
    }
    g.lineTo(bildX(FELD_HALB), bildY(DACH));
    g.stroke();
  }

  // Eine Schranke: rot-weiss gestreift, am Mast ein Kasten mit Lampe. Einen
  // Kontakt bevor sie kommt, blinkt die Lampe.
  function zeichneBalken() {
    const k = state.kontakte;
    bildTransform();
    const s = view.s;
    for (const b of state.plan.balken) {
      const warnt = state.phase !== "bereit" && k === b.ab - 1;
      if (b.raus < 0.01 && !warnt) continue;
      const kx = bildX(b.seite * (FELD_HALB - 4));
      const ky = bildY(b.y);
      if (b.raus > 0.01) {
        const st = balkenStrecke(b);
        const x0 = bildX(st.x0);
        const y0 = bildY(st.y0);
        const x1 = bildX(st.x1);
        const y1 = bildY(st.y1);
        const len = Math.hypot(x1 - x0, y1 - y0);
        const dick = BALKEN_DICK * s;
        g.save();
        g.translate(x0, y0);
        g.rotate(Math.atan2(y1 - y0, x1 - x0));
        g.fillStyle = "rgba(0, 0, 0, 0.22)";
        g.fillRect(0, -dick / 2 + 3 * s, len, dick);
        const streifen = 14 * s;
        for (let n = 0; n * streifen < len; n += 1) {
          g.fillStyle = n % 2 ? "#ffffff" : "#e8433a";
          g.fillRect(n * streifen, -dick / 2, Math.min(streifen, len - n * streifen), dick);
        }
        g.fillStyle = "rgba(255, 255, 255, 0.35)";
        g.fillRect(0, -dick / 2, len, dick * 0.25);
        g.restore();
      }
      // Der Kasten am Mast.
      g.fillStyle = "#3a3f55";
      g.fillRect(kx - 7 * s, ky - 8 * s, 14 * s, 16 * s);
      const an = warnt ? Math.sin(state.echt * 18) > 0 : b.raus > 0.5;
      g.fillStyle = an ? "#ffd23f" : "#6b6f80";
      g.beginPath();
      g.arc(kx, ky - 11 * s, 3.2 * s, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Ein Ring: eine flache Scheibe aus Licht, schräg von oben gesehen. Die
  // hintere Hälfte liegt hinter dem Ball, die vordere davor – so fliegt er
  // sichtbar hindurch. Darunter Punkte: so viele Kontakte bleibt er noch.
  function ringForm(r) {
    const alter = state.zeit - r.t0;
    let k = 1;
    if (alter < 0.4) {
      const u = alter / 0.4;
      k = 1 + Math.sin(u * Math.PI) * 0.25 - (1 - u) * (1 - u);
    }
    const rx = (r.innen + 3) * view.s * Math.max(0, k);
    return { x: bildX(r.x), y: bildY(r.y), rx, ry: rx * 0.3 };
  }

  function zeichneRinge(vorne) {
    bildTransform();
    const s = view.s;
    for (const r of state.plan.ringe) {
      if (r.t0 < 0 || r.sicht <= 0.01) continue;
      const f = ringForm(r);
      if (f.rx <= 0.5) continue;
      const von = vorne ? 0 : Math.PI;
      const bis = vorne ? Math.PI : Math.PI * 2;
      g.globalAlpha = r.sicht;
      g.globalCompositeOperation = "lighter";
      g.strokeStyle = "rgba(255, 190, 70, 0.35)";
      g.lineWidth = 9 * s;
      g.beginPath();
      g.ellipse(f.x, f.y, f.rx, f.ry, 0, von, bis);
      g.stroke();
      g.globalCompositeOperation = "source-over";
      g.strokeStyle = vorne ? "#ffd36b" : "#c97a16";
      g.lineWidth = 3.4 * s;
      g.beginPath();
      g.ellipse(f.x, f.y, f.rx, f.ry, 0, von, bis);
      g.stroke();
      if (vorne) {
        g.strokeStyle = "rgba(255, 255, 255, 0.8)";
        g.lineWidth = 1.2 * s;
        g.beginPath();
        g.ellipse(f.x, f.y + 0.8 * s, f.rx, f.ry, 0, 0.25, Math.PI - 0.25);
        g.stroke();
        const rest = Math.max(0, r.bis - state.kontakte);
        for (let n = 0; n < RING_DAUER; n += 1) {
          g.fillStyle = n < rest ? "#ffd36b" : "rgba(255, 255, 255, 0.25)";
          g.beginPath();
          g.arc(f.x + (n - (RING_DAUER - 1) / 2) * 6 * s, f.y + f.ry + 7 * s, 1.8 * s, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
    }
  }

  // Die Tauben: grau, mit schlagenden Flügeln. Getroffen, trudeln sie davon.
  function zeichneVoegel() {
    bildTransform();
    const s = view.s;
    for (const v of state.plan.voegel) {
      const o = vogelOrt(v);
      if (!o) continue;
      g.save();
      g.translate(bildX(o.x), bildY(o.y));
      g.scale(v.dir * s, s);
      if (o.weg) {
        g.rotate(o.t * 9);
        g.globalAlpha = clamp(1.6 - o.t, 0, 1);
      }
      const schlag = Math.sin(state.echt * (o.weg ? 30 : 15) + v.ab);
      g.fillStyle = "#7d8494";
      g.beginPath();
      g.moveTo(-2, -2);
      g.lineTo(-9, -6 - schlag * 9);
      g.lineTo(4, -3);
      g.closePath();
      g.fill();
      g.fillStyle = "#9aa1b0";
      g.beginPath();
      g.ellipse(0, 0, 10, 5.5, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(-9, -1);
      g.lineTo(-15, -3);
      g.lineTo(-15, 3);
      g.closePath();
      g.fill();
      g.fillStyle = "#6f7aa0";
      g.beginPath();
      g.arc(8, -3, 4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f5a623";
      g.beginPath();
      g.moveTo(11.5, -3.5);
      g.lineTo(15, -2.5);
      g.lineTo(11.5, -1.5);
      g.closePath();
      g.fill();
      g.fillStyle = "#11131c";
      g.beginPath();
      g.arc(9, -4, 1.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#b6bccb";
      g.beginPath();
      g.moveTo(-2, -1);
      g.lineTo(-7, -3 + schlag * 10);
      g.lineTo(5, -1);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  // Wo der Ball aufkommt, wenn niemand ihn trifft – ohne Wind, mit Abprallen
  // an den Masten. Für den Schatten am Boden und den Autopiloten der Tests.
  function landung(b = state.ball, k = state.kontakte) {
    const gg = gBei(k);
    let y = b.y;
    let vy = b.vy;
    let t = 0;
    // Schlägt er vorher ans Netz, fällt er von dort mit dem Rest zurück.
    const oben = DACH - b.r;
    if (vy > 0 && y + (vy * vy) / (2 * gg) > oben) {
      const d = Math.max(0, vy * vy - 2 * gg * (oben - y));
      t = (vy - Math.sqrt(d)) / gg;
      vy = -Math.sqrt(d) * DACH_PRALL;
      y = oben;
    }
    const hoch = Math.max(0, y - b.r);
    t += (vy + Math.sqrt(vy * vy + 2 * gg * hoch)) / gg;
    const rand = FELD_HALB - b.r;
    let x = b.x + b.vx * t;
    // An den Masten gespiegelt (mit dem Verlust beim Abprallen grob genähert).
    for (let n = 0; n < 4 && Math.abs(x) > rand; n += 1) x = Math.sign(x) * rand - (x - Math.sign(x) * rand) * 0.78;
    return { x: clamp(x, -rand, rand), t };
  }

  // Der Schatten des Balls und, wo er landen wird, ein Ring auf dem Rasen.
  function zeichneSchatten() {
    const b = state.ball;
    bildTransform();
    const s = view.s;
    const hoch = clamp(b.y / 300, 0, 1);
    g.fillStyle = `rgba(10, 30, 10, ${0.32 - hoch * 0.18})`;
    g.beginPath();
    g.ellipse(bildX(b.x), bildY(1), b.r * s * (1.1 - hoch * 0.45), b.r * s * 0.28 * (1.1 - hoch * 0.45), 0, 0, Math.PI * 2);
    g.fill();
    if (state.schritt !== "flug" || (state.phase !== "spiel" && state.phase !== "zuschauen")) return;
    const l = landung();
    const nah = clamp(1 - l.t / 1.2, 0, 1);
    const lx = bildX(l.x);
    const ly = bildY(1);
    g.strokeStyle = `rgba(255, 255, 255, ${0.25 + nah * 0.5})`;
    g.lineWidth = Math.max(1, 1.6 * s);
    g.setLineDash([4 * s, 3 * s]);
    g.beginPath();
    g.ellipse(lx, ly, b.r * s * (0.7 + nah * 0.4), b.r * s * 0.22 * (0.7 + nah * 0.4), 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    g.beginPath();
    g.moveTo(lx, ly - 2 * s);
    g.lineTo(lx, ly - (6 + nah * 10) * s);
    g.stroke();
  }

  // Die Gegner (geist.js): ihr Ball, halb durchsichtig in ihrer Farbe, auf
  // ihrem eigenen Weg.
  function zeichneGeister() {
    if (!gegner || state.phase === "bereit") return;
    const orte = window.LernappGeist?.orte?.(gegner) || [];
    if (!orte.length) return;
    bildTransform();
    const s = view.s;
    orte.forEach((o) => {
      // Wem im Live-Modus zugeschaut wird, der ist der Ball selbst – kein
      // Geist dazu, nur sein Name (geist.js, namen).
      if (o.ziel) return;
      const r = rBei(Math.floor((o.c || 0) / 100)) * s;
      const x = bildX(o.a);
      const y = bildY(o.b);
      g.globalAlpha = 0.42 * o.blass;
      g.fillStyle = o.farbe;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.7 * o.blass;
      g.strokeStyle = "#ffffff";
      g.lineWidth = Math.max(1, 1.2 * s);
      g.stroke();
      g.fillStyle = "rgba(20, 24, 50, 0.6)";
      g.beginPath();
      for (let k = 0; k < 5; k += 1) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5 + o.a * 0.05;
        if (k) g.lineTo(x + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36);
        else g.moveTo(x + Math.cos(a) * r * 0.36, y + Math.sin(a) * r * 0.36);
      }
      g.closePath();
      g.fill();
    });
    g.globalAlpha = 1;
    window.LernappGeist.namen(g, orte.map((o) => ({
      ...o, sx: bildX(o.a), sy: bildY(o.b) - rBei(Math.floor((o.c || 0) / 100)) * s - 4, weit: "",
    })), { breit: view.cssW, hoch: view.cssH });
  }

  // Der Ball: Muster mit Drall, Licht und Glanz darüber, gestaucht beim
  // Kick und beim Aufprall, gestreckt im schnellen Flug. In einer Serie
  // perfekter Treffer leuchtet er golden.
  function zeichneBall() {
    const b = state.ball;
    baueBall();
    bildTransform();
    const s = view.s;
    const x = bildX(b.x);
    const y = bildY(b.y);
    const r = b.r * s;
    const leuchten = Math.max(state.glanz, state.combo >= 2 ? Math.min(1, 0.3 + state.combo * 0.12) : 0);
    if (leuchten > 0.02) {
      g.globalCompositeOperation = "lighter";
      const hof = g.createRadialGradient(x, y, r * 0.6, x, y, r * 2.6);
      hof.addColorStop(0, `rgba(255, 200, 80, ${0.55 * leuchten})`);
      hof.addColorStop(1, "rgba(255, 160, 40, 0)");
      g.fillStyle = hof;
      g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
      g.globalCompositeOperation = "source-over";
    }
    const tempo = Math.hypot(b.vx, b.vy);
    const zieh = ruhig() ? 0 : Math.min(0.14, tempo / 5000);
    const zw = Math.atan2(-b.vy, b.vx);
    const D = ballBild.groesse * (b.r / R0);
    g.save();
    g.translate(x, y);
    // Stauchen beim Kick und Aufprall, Strecken im Flug.
    if (b.quetsch > 0.01 && !ruhig()) {
      g.rotate(b.quetschW);
      g.scale(1 - b.quetsch * 0.28, 1 + b.quetsch * 0.22);
      g.rotate(-b.quetschW);
    }
    if (zieh > 0.005) {
      g.rotate(zw);
      g.scale(1 + zieh, 1 - zieh * 0.7);
      g.rotate(-zw);
    }
    g.rotate(b.dreh);
    g.drawImage(ballBild.muster, -D / 2, -D / 2, D, D);
    g.rotate(-b.dreh);
    g.drawImage(ballBild.licht, -D / 2, -D / 2, D, D);
    g.restore();
  }

  // Teilchen: Staub, Gras, Federn, Funken. Die leuchtenden kommen in einem
  // zweiten Durchgang dazu («lighter»).
  function zeichneTeile() {
    if (!state.teile.length) return;
    bildTransform();
    const s = view.s;
    for (let durchgang = 0; durchgang < 2; durchgang += 1) {
      if (durchgang) g.globalCompositeOperation = "lighter";
      for (const t of state.teile) {
        const hell = t.art === "funke" || t.art === "glanz";
        if (hell !== Boolean(durchgang)) continue;
        const k = clamp(t.leben / t.max, 0, 1);
        const x = bildX(t.x);
        const y = bildY(t.y);
        g.fillStyle = t.farbe;
        if (t.art === "staub") {
          g.globalAlpha = k * 0.55;
          g.beginPath();
          g.arc(x, y, t.r * s * (2.2 - k * 1.2), 0, Math.PI * 2);
          g.fill();
        } else if (t.art === "feder" || t.art === "gras") {
          g.globalAlpha = Math.min(1, k * 2);
          g.save();
          g.translate(x, y);
          g.rotate(t.dreh);
          g.beginPath();
          g.ellipse(0, 0, t.r * s, t.r * s * (t.art === "gras" ? 0.25 : 0.4), 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
        } else {
          g.globalAlpha = k;
          g.beginPath();
          g.arc(x, y, t.r * s * (0.4 + k * 0.6), 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Die Welle am Treffpunkt: weiss beim Treffer, golden bei «Perfekt»,
  // grau und gestrichelt beim Luftloch.
  function zeichneWellen() {
    if (!state.wellen.length) return;
    bildTransform();
    const s = view.s;
    for (const w of state.wellen) {
      const u = clamp(w.alter / w.max, 0, 1);
      const r = (5 + u * (w.art === "luft" ? 16 : 30)) * s;
      g.globalAlpha = (1 - u) * (w.art === "luft" ? 0.7 : 0.95);
      g.strokeStyle = w.art === "perfekt" ? "#ffd23f" : w.art === "luft" ? "#e8eef5" : "#ffffff";
      g.lineWidth = (w.art === "luft" ? 2 : 3.5 - u * 2) * s;
      if (w.art === "luft") g.setLineDash([3 * s, 3 * s]);
      g.beginPath();
      g.arc(bildX(w.x), bildY(w.y), r, 0, Math.PI * 2);
      g.stroke();
      if (w.art === "luft") {
        g.setLineDash([]);
        // Ein kleines Kreuz: hier war nichts.
        const x = bildX(w.x);
        const y = bildY(w.y);
        const d = 4 * s;
        g.beginPath();
        g.moveTo(x - d, y - d);
        g.lineTo(x + d, y + d);
        g.moveTo(x + d, y - d);
        g.lineTo(x - d, y + d);
        g.stroke();
      }
    }
    g.setLineDash([]);
    g.globalAlpha = 1;
  }

  // Blätter im Wind: Sie kommen von der Seite, von der es gleich bläst.
  function zeichneBlaetter() {
    if (!state.blaetter.length) return;
    bildTransform();
    for (const b of state.blaetter) {
      g.save();
      g.translate(b.x, b.y);
      g.rotate(b.dreh);
      g.scale(1, Math.cos(b.flatter));
      g.globalAlpha = clamp(b.leben, 0, 1) * 0.9;
      g.fillStyle = b.farbe;
      g.beginPath();
      g.moveTo(-b.r, 0);
      g.quadraticCurveTo(0, -b.r * 0.7, b.r, 0);
      g.quadraticCurveTo(0, b.r * 0.7, -b.r, 0);
      g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const sch of state.schriften) {
      const k = clamp(sch.leben / sch.max, 0, 1);
      const alter = sch.max - sch.leben;
      const pop = alter < 0.15 && !ruhig() ? 0.6 + (alter / 0.15) * 0.4 + Math.sin((alter / 0.15) * Math.PI) * 0.25 : 1;
      const steig = (1 - k) * 24;
      const gross = Math.round(sch.gross * clamp(view.s, 0.9, 1.6) * pop);
      // Am Rand bleibt die Schrift ganz im Bild.
      const x = clamp(bildX(sch.x), gross * sch.text.length * 0.3 + 6, view.cssW - gross * sch.text.length * 0.3 - 6);
      const y = Math.max(view.frei + gross, bildY(sch.y) - steig);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.18);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(20, 30, 20, 0.75)";
      g.strokeText(sch.text, x, y);
      g.fillStyle = sch.farbe;
      g.fillText(sch.text, x, y);
    }
    g.globalAlpha = 1;
  }

  // Oben links, unter den Knöpfen: die Punkte, darunter die Serie und – wenn
  // es gleich bläst – woher.
  function zeichneAnzeige() {
    // Vor dem ersten Tipp steht dort der Satz – und die Zahl ist noch null.
    if (state.phase === "bereit") return;
    flachTransform();
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const text = String(state.punkte);
    const x = 12;
    let y = 12;
    const w = g.measureText(text).width + gross * 2.1;
    const hoch = gross * 1.6;
    g.fillStyle = "rgba(15, 30, 20, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, hoch, hoch / 2);
    else g.rect(x, y, w, hoch);
    g.fill();
    // Ein kleiner Ball vor der Zahl.
    const bx = x + gross * 0.85;
    const by = y + hoch / 2;
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(bx, by, gross * 0.42, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#1d1f2b";
    g.beginPath();
    g.arc(bx, by, gross * 0.15, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 1.5, by + 1);
    y += hoch + 6;

    const klein = Math.round(gross * 0.62);
    g.font = `900 ${klein}px system-ui, sans-serif`;
    const pille = (inhalt, farbe, schrift) => {
      const pw = g.measureText(inhalt).width + klein * 1.4;
      const ph = klein * 1.7;
      g.fillStyle = farbe;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, pw, ph, ph / 2);
      else g.rect(x, y, pw, ph);
      g.fill();
      g.fillStyle = schrift;
      g.fillText(inhalt, x + klein * 0.7, y + ph / 2 + 1);
      y += ph + 5;
    };
    if (state.combo >= 2) pille(`Perfekt ×${state.combo}`, "rgba(255, 200, 60, 0.92)", "#3a2400");
    const wind = state.wind;
    if ((wind.warn > 0 || wind.wirkt > 0.08) && state.phase !== "bereit") {
      const blink = wind.warn > 0 && Math.sin(state.echt * 14) < 0 ? 0.55 : 0.92;
      pille(wind.dir > 0 ? "Böe  →" : "←  Böe", `rgba(255, 255, 255, ${blink})`, "#1b3a22");
    }
  }

  function zeichnen() {
    if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0);
    zeichneHintergrund();
    zeichneFlutlicht();
    zeichneFahne();
    zeichneNetz();
    zeichneRinge(false);
    zeichneBalken();
    zeichneSchatten();
    zeichneVoegel();
    zeichneGeister();
    zeichneBall();
    zeichneRinge(true);
    zeichneTeile();
    zeichneBlaetter();
    zeichneWellen();
    zeichneSchriften();
    if (state.blitz > 0.01 && !ruhig()) {
      flachTransform();
      g.fillStyle = `rgba(255, 245, 230, ${state.blitz * 0.22})`;
      g.fillRect(0, 0, view.cssW, view.cssH);
    }
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const TEILE_MAX = 180;
  const BLAETTER_MAX = 36;
  const LICHT_AB = 44;             // ab hier ist Nacht, und das Flutlicht geht an

  function teil(t) {
    if (state.teile.length >= TEILE_MAX) state.teile.shift();
    state.teile.push(t);
  }

  function staub(x, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const farben = ["#d9c9a0", "#bfa877", "#e8dcc0"];
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI;
      const v = 30 + Math.random() * 110;
      teil({ art: "staub", x: x + (Math.random() - 0.5) * 16, y: 3, vx: Math.cos(w) * v, vy: Math.sin(w) * v * 0.6,
        r: 3 + Math.random() * 4, farbe: farben[i % 3], leben: 0.7 + Math.random() * 0.5, max: 1.2, dreh: 0 });
    }
    for (let i = 0; i < anzahl / 2; i += 1) {
      teil({ art: "gras", x: x + (Math.random() - 0.5) * 10, y: 2, vx: (Math.random() - 0.5) * 160, vy: 80 + Math.random() * 160,
        r: 2.5 + Math.random() * 2, farbe: i % 2 ? "#3f8f35" : "#6cc456", leben: 0.8, max: 0.8, dreh: Math.random() * 6 });
    }
  }

  function funken(x, y, anzahl, farben, tempo = 160) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * Math.PI * 2;
      const v = tempo * (0.4 + Math.random() * 0.8);
      teil({ art: "funke", x, y, vx: Math.cos(w) * v, vy: Math.sin(w) * v, r: 1.2 + Math.random() * 1.8,
        farbe: farben[i % farben.length], leben: 0.35 + Math.random() * 0.4, max: 0.75, dreh: 0 });
    }
  }

  function federn(x, y) {
    const anzahl = ruhig() ? 3 : 9;
    for (let i = 0; i < anzahl; i += 1) {
      teil({ art: "feder", x, y, vx: (Math.random() - 0.5) * 90, vy: 20 + Math.random() * 60, r: 3 + Math.random() * 2,
        farbe: i % 2 ? "#e6e9f0" : "#9aa1b0", leben: 1.4, max: 1.4, dreh: Math.random() * 6 });
    }
  }

  function welle(x, y, art) {
    state.wellen.push({ x, y, art, alter: 0, max: art === "luft" ? 0.35 : 0.45 });
    if (state.wellen.length > 8) state.wellen.shift();
  }

  function schrift(text, x, y, farbe, gross, dauer = 1.1) {
    // Kommen zwei zugleich an dieselbe Stelle, steht die neue darüber.
    for (const alt of state.schriften) {
      if (alt.leben > alt.max * 0.5 && Math.abs(alt.x - x) < 90 && Math.abs(alt.y - y) < 24) y = alt.y + 26;
    }
    state.schriften.push({ text, x, y, farbe, gross, leben: dauer, max: dauer });
    if (state.schriften.length > 6) state.schriften.shift();
  }

  // ---------------------------------------------------------------------------
  // Der Kick
  // ---------------------------------------------------------------------------
  /*
   * off: wo der Tipp den Ball traf, von -1 (ganz links) bis 1 (ganz rechts).
   * Links getroffen fliegt er nach rechts, rechts getroffen nach links – je
   * weiter aussen, desto schräger und desto mehr Drall. Hinauf geht es bis
   * APEX, von weiter oben wenigstens um HUB_MIN – dann bis ans Netz.
   */
  function kick(off, tx, ty) {
    const b = state.ball;
    const k = state.kontakte;
    const gg = gBei(k);
    const hub = Math.max(HUB_MIN, APEX - b.y);
    b.vy = Math.sqrt(2 * gg * hub);
    b.vx = -off * vxBei(k);
    b.w = -off * DRALL;
    if (Math.abs(b.w) < 3) b.w = b.w < 0 ? -3 : 3;
    b.quetsch = 1;
    b.quetschW = Math.atan2(-b.vy, b.vx);
    state.kontakte += 1;
    state.letzterKick = state.zeit;
    state.letzterTipp = { zeit: state.zeit, traf: true };

    const perfekt = Math.abs(off) < PERFEKT;
    if (perfekt) {
      state.combo += 1;
      const dazu = state.combo >= 5 ? 2 : 1;
      state.bonus += dazu;
      state.glanz = 1;
      schrift(state.combo >= 3 ? `Perfekt ×${state.combo}` : "Perfekt!", b.x, b.y + b.r + 26, "#ffd23f", state.combo >= 3 ? 20 : 17, 0.9);
      funken(tx, ty, 14, ["#fff4c2", "#ffd23f", "#ffb02e"], 190);
    } else {
      if (state.combo >= 3) schrift("Serie vorbei", b.x, b.y + b.r + 24, "#e8eef5", 13, 0.8);
      state.combo = 0;
      funken(tx, ty, 6, ["#ffffff", "#dfe8ff"], 120);
    }
    kickKlang(perfekt);
    state.besteCombo = Math.max(state.besteCombo, state.combo);
    state.punkte = state.kontakte + state.bonus;
    shell.setCount(state.punkte);
    welle(tx, ty, perfekt ? "perfekt" : "treffer");
    kids()?.vibrate?.(perfekt ? 14 : 8);

    if (state.kontakte % 25 === 0) schrift(`${state.kontakte} Kontakte!`, 0, 320, "#ffffff", 22, 1.4);
    if (state.kontakte === LICHT_AB) {
      state.lichtAn = state.echt;
      schrift("Flutlicht an!", 0, 300, "#fff6c8", 20, 1.4);
    }
    kontaktBeginnt(state.kontakte);
  }

  // Ein Tipp neben den Ball: zählt nicht, eine Serie reisst, und eine
  // Viertelsekunde lang zählt kein Tipp – wildes Tippen hilft nicht.
  function luftloch(x, y) {
    welle(x, y, "luft");
    state.letzterTipp = { zeit: state.zeit, traf: false };
    state.sperreBis = state.zeit + LUFT_SPERRE;
    if (state.combo >= 3) schrift("Serie vorbei", state.ball.x, state.ball.y + state.ball.r + 24, "#e8eef5", 13, 0.8);
    state.combo = 0;
    schrift("Luftloch", x, y + 18, "#e8eef5", 12, 0.6);
    // Ein Fehler, der die Runde nicht beendet: leise.
    tonMitPause("fehler", { laut: 0.45 });
  }

  function ringTreffer(r, still = false) {
    r.getroffen = state.zeit;
    const b = state.ball;
    funken(r.x, r.y, 22, ["#fff4c2", "#ffd23f", "#ff9f1c", "#ffffff"], 220);
    klang()?.ton("punkt");
    if (still) return;
    state.bonus += 3;
    state.ringe += 1;
    state.punkte = state.kontakte + state.bonus;
    shell.setCount(state.punkte);
    state.glanz = 1;
    schrift("Treffer! +3", r.x, r.y + 30, "#ffd23f", 20, 1.1);
    kids()?.vibrate?.([10, 30, 10]);
    if (b) b.quetsch = Math.max(b.quetsch, 0.4);
  }

  // ---------------------------------------------------------------------------
  // Der Flug
  // ---------------------------------------------------------------------------
  // Ein Kreis prallt an einer Strecke mit Dicke ab (Schranke).
  function prallAnStrecke(b, x0, y0, x1, y1, dick, e) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const l2 = dx * dx + dy * dy || 1;
    const u = clamp(((b.x - x0) * dx + (b.y - y0) * dy) / l2, 0, 1);
    const qx = x0 + dx * u;
    const qy = y0 + dy * u;
    const nx0 = b.x - qx;
    const ny0 = b.y - qy;
    const d = Math.hypot(nx0, ny0);
    const min = b.r + dick;
    if (d >= min || d < 1e-6) return false;
    const nx = nx0 / d;
    const ny = ny0 / d;
    b.x = qx + nx * min;
    b.y = qy + ny * min;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      b.vx -= (1 + e) * vn * nx;
      b.vy -= (1 + e) * vn * ny;
      return -vn;
    }
    return 0.0001;
  }

  function physik(h) {
    const b = state.ball;
    const k = state.kontakte;
    b.vy -= gBei(k) * h;
    b.vx += state.wind.ax * h;
    b.vx *= 1 - 0.12 * h;
    const altY = b.y;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.dreh += b.w * h;
    b.w *= 1 - 0.25 * h;

    // Die Masten.
    const rand = FELD_HALB - b.r;
    if (Math.abs(b.x) > rand) {
      const seite = Math.sign(b.x);
      b.x = seite * rand;
      if (b.vx * seite > 0) {
        if (Math.abs(b.vx) > 40) {
          funken(seite * FELD_HALB, b.y, 8, ["#ffffff", "#ffe2a8"], 120);
          state.stoss = Math.max(state.stoss, 0.25);
          b.quetsch = Math.max(b.quetsch, 0.6);
          b.quetschW = 0;
          kids()?.vibrate?.(6);
        }
        b.vx = -b.vx * 0.78;
        b.w = -b.w * 0.6 - seite * b.vy * 0.02;
      }
    }

    // Das Netz oben: Es fängt den Ball und lässt ihn schwach zurückfallen.
    if (b.y + b.r > DACH) {
      b.y = DACH - b.r;
      if (b.vy > 0) {
        state.netz = { x: b.x, t: state.zeit, staerke: clamp(b.vy / 500, 0.3, 1) };
        b.vy = -b.vy * DACH_PRALL;
        b.vx *= 0.8;
        b.w *= 0.5;
        b.quetsch = Math.max(b.quetsch, 0.5);
        b.quetschW = Math.PI / 2;
        tonMitPause("ball.netz", { laut: 0.5 + 0.5 * state.netz.staerke });
        if (state.phase === "spiel") kids()?.vibrate?.(6);
      }
    }

    // Die Schranken.
    for (const s of state.plan.balken) {
      if (s.raus < 0.05) continue;
      const st = balkenStrecke(s);
      const stoss = prallAnStrecke(b, st.x0, st.y0, st.x1, st.y1, BALKEN_DICK / 2, 0.55);
      if (stoss > 60) {
        funken(b.x, b.y - b.r * 0.5, 6, ["#ffffff", "#ffb3a8"], 110);
        b.quetsch = Math.max(b.quetsch, 0.5);
        b.quetschW = Math.PI / 2;
      }
    }

    // Die Tauben.
    for (const v of state.plan.voegel) {
      if (v.t0 < 0 || v.getroffen >= 0) continue;
      const o = vogelOrt(v);
      if (!o) continue;
      const dx = b.x - o.x;
      const dy = b.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d >= b.r + VOGEL_R || d < 1e-6) continue;
      const nx = dx / d;
      const ny = dy / d;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= 1.8 * vn * nx;
        b.vy -= 1.8 * vn * ny;
      }
      b.x = o.x + nx * (b.r + VOGEL_R);
      b.y = o.y + ny * (b.r + VOGEL_R);
      v.getroffen = state.zeit;
      v.hx = o.x;
      v.hy = o.y;
      federn(o.x, o.y);
      klang()?.ton("ball.taube");
      b.quetsch = Math.max(b.quetsch, 0.5);
      b.quetschW = Math.atan2(ny, -nx);
      if (state.phase === "spiel") kids()?.vibrate?.(10);
    }

    // Die Ringe: Wer die Höhe des Rings in seiner Öffnung kreuzt, trifft.
    for (const r of state.plan.ringe) {
      if (!ringAktiv(r)) continue;
      if ((altY - r.y) * (b.y - r.y) <= 0 && altY !== b.y && Math.abs(b.x - r.x) < r.innen - b.r * 0.5) ringTreffer(r);
    }

    if (b.y - b.r <= 0) aufschlag();
  }

  const ringAktiv = (r) => r.t0 >= 0 && r.getroffen < 0 && state.kontakte < r.bis;

  // Der Ball liegt am Boden: Er hüpft noch ein wenig und rollt aus.
  function rollen(h) {
    const b = state.ball;
    b.vy -= gBei(state.kontakte) * h;
    b.y += b.vy * h;
    if (b.y < b.r) {
      b.y = b.r;
      b.vy = b.vy < -60 ? -b.vy * 0.35 : 0;
    }
    b.vx *= 1 - 2.2 * h;
    b.x = clamp(b.x + b.vx * h, -FELD_HALB + b.r, FELD_HALB - b.r);
    b.dreh += (b.vx / b.r) * h;
  }

  // Der Fehler: Der Ball schlägt auf. Woran es lag, steht gross daneben.
  function aufschlag() {
    const b = state.ball;
    if (state.schritt === "aus") return;
    state.schritt = "aus";
    state.ausZeit = state.zeit;
    const luft = !state.letzterTipp.traf && state.letzterTipp.zeit > state.letzterKick;
    state.grund = luft ? "daneben getippt!" : "zu spät!";
    b.y = b.r;
    b.vy = Math.abs(b.vy) * 0.35;
    b.vx *= 0.6;
    b.quetsch = 1;
    b.quetschW = Math.PI / 2;
    state.stoss = 1;
    state.blitz = 1;
    if (!ruhig()) state.lupe = 0.3;
    staub(b.x, 22);
    // Das Publikum verstummt, der Ball schlägt auf – auch am Ende einer
    // Runde, die man anschaut.
    publikumAus();
    klang()?.ton("ball.rasen");
    if (state.phase === "zuschauen") {
      schrift("Aus!", b.x, b.y + 60, "#ff9a7a", 24, 1.3);
      return;
    }
    schrift(state.grund, b.x, b.y + 60, "#ff9a7a", 24, 1.3);
    kids()?.vibrate?.([30, 40, 60]);
    stepTimer = window.setTimeout(finish, 1100);
  }

  // Wie weit der Tag ist: Nachmittag bis 12 Kontakte, dann wird es Abend,
  // ab LICHT_AB Nacht mit Flutlicht.
  const tagZiel = (k) => (k < 12 ? 0 : k < 32 ? (k - 12) / 20 : k < LICHT_AB ? 1 : 1 + Math.min(1, (k - LICHT_AB) / 6));

  function takt(dt) {
    state.echt += dt;
    if (state.lupe > 0) {
      state.lupe -= dt;
      dt *= 0.35;
    }
    state.zeit += dt;
    const b = state.ball;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 2.8);
    if (state.blitz > 0) state.blitz = Math.max(0, state.blitz - dt * 3);
    if (state.glanz > 0) state.glanz = Math.max(0, state.glanz - dt * 1.6);
    if (b.quetsch > 0) b.quetsch = Math.max(0, b.quetsch - dt * 6);
    windLage();

    if (state.phase === "zuschauen") {
      zuschauenTakt(dt);
    } else if (state.schritt === "flug" || state.schritt === "aus") {
      const n = Math.max(1, Math.ceil(dt / TAKT - 1e-9));
      for (let i = 0; i < n; i += 1) {
        if (state.schritt === "flug") physik(dt / n);
        else rollen(dt / n);
      }
    } else {
      // Vor dem ersten Tipp schwebt der Ball und dreht sich langsam.
      b.x = 0;
      b.y = state.schwebeY + (ruhig() ? 0 : Math.sin(state.echt * 2.2) * 6);
      b.vx = 0;
      b.vy = 0;
      b.dreh += dt * 0.8;
    }
    if (state.phase !== "zuschauen") b.r += (rBei(state.kontakte) - b.r) * Math.min(1, dt * 4);

    // Was sich im Plan bewegt: Schranken klappen, Ringe blenden.
    const k = state.kontakte;
    for (const s of state.plan.balken) {
      const ziel = k >= s.ab && k < s.bis && state.phase !== "bereit" ? 1 : 0;
      s.raus = clamp(s.raus + Math.sign(ziel - s.raus) * dt * 3, 0, 1);
    }
    for (const r of state.plan.ringe) {
      const ziel = ringAktiv(r) ? 1 : 0;
      r.sicht = clamp((r.sicht || 0) + Math.sign(ziel - (r.sicht || 0)) * dt * (ziel ? 6 : 3), 0, 1);
    }

    // Fahne, Tageszeit, Blätter.
    const w = state.wind;
    const fahneZiel = w.warn > 0 || w.wirkt > 0.02 ? w.dir * clamp(w.warn * 0.75 + w.wirkt, 0, 1) : 0.12;
    state.fahne += (fahneZiel - state.fahne) * Math.min(1, dt * 4);
    const tagZu = tagZiel(k);
    state.tag += clamp((tagZu - state.tag) * dt * 0.9, -dt * 0.5, dt * 0.5);
    if (Math.abs(tagZu - state.tag) < 0.004) state.tag = tagZu;
    const blasen = w.warn * 0.6 + w.wirkt;
    if (blasen > 0.05 && Math.random() < dt * 16 * blasen * (ruhig() ? 0.3 : 1) && state.blaetter.length < BLAETTER_MAX) {
      const farben = ["#e8a33d", "#c9652b", "#9bbf3f", "#d9b54a"];
      state.blaetter.push({
        x: w.dir > 0 ? -12 : view.cssW + 12, y: view.cssH * (0.12 + Math.random() * 0.72),
        vx: w.dir * (220 + Math.random() * 200), vy: (Math.random() - 0.4) * 40,
        r: 3 + Math.random() * 3, dreh: Math.random() * 6, flatter: Math.random() * 6,
        farbe: farben[Math.floor(Math.random() * farben.length)], leben: 4,
      });
    }
    for (let i = state.blaetter.length - 1; i >= 0; i -= 1) {
      const bl = state.blaetter[i];
      const schub = 0.35 + w.wirkt + w.warn * 0.3;
      bl.x += bl.vx * dt * schub;
      bl.y += bl.vy * dt + Math.sin(bl.flatter) * 20 * dt;
      bl.flatter += dt * 7;
      bl.dreh += dt * 4;
      bl.leben -= dt;
      if (bl.leben <= 0 || bl.x < -30 || bl.x > view.cssW + 30) state.blaetter.splice(i, 1);
    }

    // Eine Serie lässt den Ball Funken ziehen.
    if (state.combo >= 3 && state.schritt === "flug" && !ruhig() && Math.random() < dt * 40) {
      teil({ art: "glanz", x: b.x + (Math.random() - 0.5) * b.r, y: b.y + (Math.random() - 0.5) * b.r, vx: -b.vx * 0.1,
        vy: -b.vy * 0.1, r: 1.5 + Math.random() * 1.5, farbe: "#ffd23f", leben: 0.5, max: 0.5, dreh: 0 });
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      if (t.art === "funke") t.vy -= 320 * dt;
      else if (t.art === "gras") t.vy -= 420 * dt;
      else if (t.art === "feder") { t.vy = Math.max(t.vy - 70 * dt, -28); t.vx += Math.sin(t.leben * 6) * 60 * dt; }
      else if (t.art === "staub") t.vy -= 15 * dt;
      t.vx *= 1 - 1.8 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.dreh += dt * 5;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.wellen.length - 1; i >= 0; i -= 1) {
      state.wellen[i].alter += dt;
      if (state.wellen[i].alter > state.wellen[i].max) state.wellen.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }

    if (state.phase === "spiel") {
      gegner?.takt(state.punkte, { a: Math.round(b.x), b: Math.round(b.y), c: state.kontakte * 100 + Math.min(99, state.combo) });
    }
    publikumStellen();
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    messen();
    takt(dt);
    zeichnen();
  }

  // ---------------------------------------------------------------------------
  // Zuschauen
  // ---------------------------------------------------------------------------
  // Eine aufgezeichnete Runde mit ihrem eigenen Plan: Der Zufall hält die
  // Saat (geist.js, zuschauer), startRun würfelt damit dieselben Ringe, Böen
  // und Tauben, und der Ball steht Bild für Bild dort, wo er damals war. Aus
  // c kommen die Kontakte und die Serie – damit tauchen Ringe und Böen zur
  // selben Zeit auf, und jeder Kontakt bekommt seine Welle.
  function zuschauenStarten() {
    if (!zuschauer?.lauf) return;
    startRun();
    state.phase = "zuschauen";
    state.schritt = "flug";
    shell.setPhase("play");
    zuschauer.los();
    publikumAn();
  }

  function zuschauenTakt(dt) {
    const s = zuschauer.stand();
    if (!s) return;
    const b = state.ball;
    const altY = b.y;
    b.x = s.a;
    b.y = s.b;
    b.vx = s.va || 0;
    b.vy = s.vb || 0;
    const c = Math.max(0, Math.round(s.c || 0));
    const kontakte = Math.floor(c / 100);
    while (state.kontakte < kontakte) {
      state.kontakte += 1;
      kontaktBeginnt(state.kontakte);
      const perfekt = c % 100 > state.combo;
      kickKlang(perfekt, c % 100);
      welle(b.x, b.y - b.r * 0.6, perfekt ? "perfekt" : "treffer");
      if (perfekt) state.glanz = 1;
      b.quetsch = 1;
      b.quetschW = Math.atan2(-Math.max(1, b.vy), b.vx);
      b.w = clamp(b.vx / vxBei(state.kontakte), -1, 1) * DRALL;
      if (Math.abs(b.w) < 3) b.w = b.w < 0 ? -3 : 3;
      if (state.kontakte === LICHT_AB) state.lichtAn = state.echt;
    }
    state.combo = c % 100;
    b.r += (rBei(state.kontakte) - b.r) * Math.min(1, dt * 4);
    b.dreh += b.w * dt;
    for (const r of state.plan.ringe) {
      if (ringAktiv(r) && (altY - r.y) * (b.y - r.y) <= 0 && altY !== b.y && Math.abs(b.x - r.x) < r.innen - b.r * 0.3) ringTreffer(r, true);
    }
    for (const v of state.plan.voegel) {
      if (v.t0 < 0 || v.getroffen >= 0) continue;
      const o = vogelOrt(v);
      if (o && Math.hypot(b.x - o.x, b.y - o.y) < b.r + VOGEL_R + 2) {
        v.getroffen = state.zeit;
        v.hx = o.x;
        v.hy = o.y;
        federn(o.x, o.y);
        klang()?.ton("ball.taube");
      }
    }
    // Im Spiel kommt der Ball nur am Schluss auf den Rasen. Die erste Probe
    // eines Laufs liegt noch bei null (geist.js nimmt sie vor dem ersten
    // Bild) – darum zählt ein Aufschlag erst nach einer halben Sekunde, sonst
    // hiesse es gleich zu Beginn «Aus!», und das Publikum verstummte. Und
    // springt der Ball zwischen zwei Proben auf, ist er spätestens am Ende
    // des Laufs auf dem Rasen.
    const amEnde = Boolean(zuschauer.fertig?.());
    if (state.schritt !== "aus" && s.t > 500 && (amEnde || s.b <= rBei(state.kontakte) + 2)) aufschlag();
    const punkte = Math.max(0, Math.floor(s.punkte));
    if (punkte !== state.punkte) {
      state.punkte = punkte;
      shell.setCount(punkte);
    }
    zuschauer.weiter();
    if (zuschauer.fertig?.()) publikumAus();
  }

  // ---------------------------------------------------------------------------
  // Tippen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp auf den Ball – oder im
  // Live-Modus zum gemeinsamen Start (game-shell.js, live.los) und mit der
  // Tastatur; dann bekommt der Ball einen kleinen Anstoss nach oben, und man
  // muss ihn erst einmal erwischen.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.schritt = "flug";
    state.ball.vy = 140;
    state.ball.vx = 0;
    state.letzterKick = state.zeit - 1;
    shell.setPhase("play");
    gegner?.los();
    kids()?.vibrate?.(8);
    publikumAn();
  }

  /*
   * Ein Tipp in Weltkoordinaten (x: 0 ist die Mitte des Platzes, y: 0 der
   * Rasen, nach oben). Er trifft, wenn er höchstens gut einen Radius (und
   * ein paar Bildpunkte für den Finger) vom Ball weg ist – gemessen dort, wo
   * der Ball jetzt ist, und dort, wo er vor zwei Bildern war: So viel hinkt
   * das Auge hinterher. Gibt zurück, ob der Ball getroffen wurde.
   */
  function tippe(x, y) {
    if (state.phase === "zuschauen" || state.phase === "ende" || state.schritt === "aus") return false;
    const b = state.ball;
    const toleranz = b.r * 1.15 + 9 / view.s;
    const d1 = Math.hypot(x - b.x, y - b.y);
    const px = b.x - b.vx * 0.033;
    const py = b.y - b.vy * 0.033;
    const d2 = Math.hypot(x - px, y - py);
    const traf = Math.min(d1, d2) <= toleranz;
    if (state.phase === "bereit") {
      // Im Live-Modus beginnt die Runde für alle zugleich (live.los).
      if (!traf || shell.live) { welle(x, y, "luft"); return false; }
      losGehts();
    }
    if (state.zeit < state.sperreBis) {
      // Noch vom Luftloch: Der Tipp geht ins Leere, nur ein Hauch zeigt ihn.
      welle(x, y, "luft");
      return false;
    }
    if (!traf) {
      luftloch(x, y);
      return false;
    }
    if (state.zeit - state.letzterKick < SPERRE) return false;
    const mitte = d1 <= d2 ? b.x : px;
    kick(clamp((x - mitte) / b.r, -1, 1), x, y);
    return true;
  }

  // Derselbe Tipp in Bildpunkten der Leinwand (CSS-Pixel, von oben links).
  function tippeBild(sx, sy) {
    return tippe(weltX(sx - wackelX()), weltY(sy - wackelY()));
  }

  // Mit der Tastatur: ← kickt nach links, → nach rechts, ↑ und Leertaste
  // gerade hoch – aber nur, wenn der Ball unten am Fuss ist (unter KNIE).
  // Die Richtung wählt man, das Timing muss stimmen; perfekt wird es so nie.
  const KNIE = 75;
  function taste(art) {
    if (state.phase === "zuschauen" || state.phase === "ende" || state.schritt === "aus") return;
    if (state.phase === "bereit") { if (!shell.live) losGehts(); return; }
    const b = state.ball;
    if (state.zeit < state.sperreBis) return;
    if (b.y - b.r > KNIE || b.vy > 0) {
      luftloch(b.x, Math.max(10, b.y - b.r - 30));
      return;
    }
    if (state.zeit - state.letzterKick < SPERRE) return;
    const off = art === "links" ? 0.6 : art === "rechts" ? -0.6 : 0.25 * (b.x > 0 ? 1 : -1);
    kick(off, b.x + off * b.r, b.y - b.r * 0.5);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    publikumAus();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.schritt = "warten";
    state.punkte = 0;
    state.kontakte = 0;
    state.bonus = 0;
    state.combo = 0;
    state.besteCombo = 0;
    state.ringe = 0;
    state.ball = { x: 0, y: state.schwebeY, vx: 0, vy: 0, w: 0, dreh: 0, r: R0, quetsch: 0, quetschW: 0 };
    state.plan = { bloecke: 0, ringe: [], boeen: [], voegel: [], balken: [] };
    planBis(BLOCK * 2);
    state.wind = { ax: 0, warn: 0, wirkt: 0, dir: 0 };
    state.fahne = 0.12;
    state.tag = 0;
    state.lichtAn = -9;
    state.letzterKick = -9;
    state.letzterTipp = { zeit: -9, traf: true };
    state.sperreBis = -9;
    state.grund = "";
    state.ausZeit = 0;
    state.netz = { x: 0, t: -9, staerke: 0 };
    state.teile = [];
    state.wellen = [];
    state.schriften = [];
    state.blaetter = [];
    state.stoss = 0;
    state.blitz = 0;
    state.glanz = 0;
    state.lupe = 0;
    state.zeit = 0;
    state.echt = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    promptKnoten = shell.el("p", "cm-prompt bh-prompt", "Tipp den Ball an – er fliegt weg vom Finger.");
    shell.play.append(promptKnoten, buildPlatz());
    view.cssW = 0;
    view.cssH = 0;
    messen();
    state.ball.y = state.schwebeY;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 4);
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

  function finish() {
    clearStep();
    stopLoop();
    publikumAus();
    if (state.phase === "ende" || state.phase === "zuschauen") return;
    state.phase = "ende";
    const punkte = state.punkte;
    const geist = gegner?.ende(punkte) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    // Woran es lag, und was dazukam.
    const grund = state.grund === "daneben getippt!" ? "Daneben getippt" : state.grund ? "Zu spät getippt" : "";
    const dazu = state.bonus ? `${state.kontakte} Kontakte + ${state.bonus} Bonus` : "";
    const best = vorher ? `Bestwert ${vorher}` : "";
    shell.showResult({
      label: "Deine Kontakte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : [grund, dazu, best].filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("bh-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  shell = shellApi.mount({
    host,
    title: "Ball hochhalten",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "keepyUppy", fassung: "t1", zufall, einheit: "Kontakte", nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "keepyUppy", host, art: "tempo", alle: true, zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Jeder Finger zählt für sich: Wer mit zwei Fingern tippt, tippt zweimal.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    tippeBild((event.clientX - rect.left) * (view.cssW / rect.width), (event.clientY - rect.top) * (view.cssH / rect.height));
  });

  const TASTEN = { ArrowLeft: "links", ArrowRight: "rechts", ArrowUp: "hoch", " ": "hoch", Enter: "hoch" };
  document.addEventListener("keydown", (event) => {
    const art = TASTEN[event.key];
    if (!art) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    taste(art);
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); publikumAus(); });

  // Für die Prüfskripte. tippe(x, y) nimmt Weltkoordinaten (x: 0 Mitte des
  // Platzes, y: 0 Rasen, nach oben), tippeBild(sx, sy) CSS-Pixel der
  // Leinwand. ball ist der Ball (x, y, vx, vy, r, w), landung() sagt, wo er
  // ohne Wind aufkommt.
  window.LernappBall = {
    FELD_HALB, APEX, HUB_MIN, DACH, PERFEKT, TAKT, state, view, takt, tippe, tippeBild, taste, losGehts,
    get ball() { return state.ball; },
    planBis, gBei, rBei, vxBei, windBei, landung, balkenStrecke, vogelOrt, bildX, bildY,
  };
})();
