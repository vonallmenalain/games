/*
 * feuerseil.js – Feuerseil.
 * ---------------------------------------------------------------------------
 * Ein Dorfplatz bei Nacht, Lichterketten über dem Pflaster, dahinter die
 * Berge. Zwei Feuerkünstler schwingen ein brennendes Seil, und in der Mitte
 * steht, wer spielt. Eine Regel: Tippen heisst hüpfen, Halten springt höher.
 * Geht das Seil unten durch, muss man über den Flammen sein.
 *
 * Das ist alles – und das Seil macht den Rest. Es wird Strophe um Strophe
 * schneller (sechs Durchgänge sind eine Strophe), die Flammen schlagen
 * höher, und jede Strophe hat ihre Figur:
 *
 *   gleich      gleichmässig, im Tempo der Strophe
 *   wechsel     ein Durchgang langsam, einer schnell
 *   zeitlupe    mittendrin zwei Durchgänge fast doppelt so lang – wer im
 *               Takt weiterhüpft, landet zu früh
 *   zoegern     das Seil hängt oben einen Augenblick, dann fällt es
 *   doppel      ein zweites Seil, blau, in der Gegenrichtung – halb versetzt
 *               oder (später) «kurz–lang»
 *   kehre       oben kehrt das Seil um und kommt von der anderen Seite
 *   schnapper   ab dem höchsten Punkt schnappt es schneller herunter
 *   wild        später: jeder Durchgang etwas anderes
 *
 * Der Sprung ist der aus jedem guten Hüpfspiel: Der Tipp springt sofort ab,
 * und solange der Finger liegt, trägt der Sprung weiter – kurz getippt gut
 * 30 cm hoch und eine gute Viertelsekunde lang, ganz gehalten knapp 70 cm
 * und eine halbe Sekunde. Hoch ist sicher über den Flammen, aber lang in der
 * Luft; flach ist schnell wieder unten, aber knapp. Am Anfang ist das egal,
 * am Ende ist es alles: Wenn das Seil schneller dreht, als ein Hüpfer
 * dauert, hilft nur noch ein hoher Sprung über zwei Durchgänge.
 *
 * Gezählt wird jedes Seil, das unten durchgeht: ein Punkt. Geht es genau
 * im höchsten Punkt des Sprungs durch (PERFEKT Schritte davor oder danach),
 * ist das «Perfekt» und gibt einen Punkt dazu – in Folge zwei, drei, vier
 * (KETTE_MAX). Die erste Berührung beendet die Runde. Und sie endet immer:
 * Ab Strophe ENDE_AB wachsen die Flammen Strophe um Strophe weiter, bis
 * über jede Sprunghöhe.
 *
 * Gerechnet wird in festen Schritten (HZ je Sekunde), und nur mit Plus,
 * Minus, Mal und Geteilt – so ist jede Runde auf jedem Gerät dieselbe. Das
 * Seil misst in Umdrehungen: u = 0 ist unten, 0,5 oben; es kommt vorn
 * herunter und geht hinten hinauf. Sein Tempo folgt dem Ziel der Runde mit
 * etwas Nachzug (NACHZUG), darum sieht man jeden Tempowechsel kommen. Das
 * zweite Seil hängt fest am ersten: versatz − u.
 *
 * Gewürfelt wird nur die Folge der Figuren (zufall.js): ohne Turnier jede
 * Runde anders, im Turnier für alle im selben Versuch gleich.
 *
 * Gegner (geist.js): Platz 1 und die eigene Bestmarke als Zielmarke. Jedes
 * Drücken und Loslassen ist ein Zug (geist.js, zuege; live-spiel.js, zug) mit
 * dem Schritt, in dem es geschah. Wer zuschaut, rechnet dieselbe Runde mit
 * denselben Zügen nach – Seil, Sprünge und Punkte sind dieselben.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "firerope") return;

  const host = document.querySelector("#fe-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: nur die Folge der Figuren. Funken, Rauch und Flackern
  // würfeln Math.random – sie hängen daran, wie jemand springt.
  const zufall = window.LernappZufall?.fuer?.("fireRope") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const HZ = 240;
  const TAKT = 1 / HZ;             // ein Schritt der Rechnung

  // Der Sprung (Meter, Sekunden). Solange gehalten wird und es aufwärts
  // geht, bremst nur die Schwerkraft; losgelassen bremst sie SCHNITT-mal so
  // stark – so wird aus einem kurzen Tipp ein flacher Hüpfer.
  const G = 20;
  const V0 = 5.2;
  const SCHNITT = 3;
  const HALT_MIN = 8;              // so viele Schritte gilt jeder Tipp als gehalten
  const PUFFER = 24;               // ein Tipp so kurz vor der Landung springt gleich wieder ab

  // Das Seil.
  const NACHZUG = 0.03;            // je Schritt so viel des Wegs zum Zieltempo
  const P0 = 1.15;                 // Sekunden je Umdrehung in der ersten Strophe …
  const P_FAKTOR = 0.925;          // … und je Strophe so viel davon
  const P_MIN = 0.22;
  const STROPHE = 6;               // Durchgänge je Strophe
  const ZOEGER_REST = 0.12;        // so viel Tempo bleibt beim Zögern
  const SCHNAPP = 1.7;             // so viel schneller schnappt es herunter
  const DOPPEL_LANGSAM = 1.6;      // mit zwei Seilen dreht jedes so viel langsamer
  const START_U = 0.08;            // dort hängt das Seil vor dem ersten Tipp (knapp hinter den Füssen)

  // Die Flammen: so hoch muss man beim Durchgang sein (Meter). Ab ENDE_AB
  // wachsen sie über jede Sprunghöhe – dort endet auch die beste Runde.
  const FLAMME0 = 0.14;
  const FLAMME_PLUS = 0.016;
  const FLAMME_MAX = 0.38;
  const ENDE_AB = 16;
  const ENDE_PLUS = 0.06;

  // Perfekt: das Seil geht höchstens so viele Schritte vor oder nach dem
  // höchsten Punkt durch. In Folge gibt es immer mehr, bis KETTE_MAX.
  const PERFEKT = 8;
  const KETTE_MAX = 4;

  // Ab welcher Strophe es welche Figur gibt.
  const AB_STROPHE = { gleich: 0, wechsel: 2, zeitlupe: 2, zoegern: 3, doppel: 4, kehre: 5, schnapper: 7, wild: 10 };
  const FIGUREN = Object.keys(AB_STROPHE);
  const ANSAGE = {
    gleich: "", wechsel: "Wechseltempo", zeitlupe: "Zeitlupe", zoegern: "Zögern",
    doppel: "Zwei Seile", kehre: "Kehre", schnapper: "Schnapper", wild: "Wild",
  };

  // Die Züge.
  const ZUG_START = 0;
  const ZUG_DRUCK = 1;
  const ZUG_LOS = 2;
  const ZUG_ENDE = 5;
  const ZUG_VORHER = 6;            // so viele Züge davor trägt jeder im Multiplayer mit (b)
  const AUFHOLEN_MAX = 48;         // so viele Schritte holt ein Bild höchstens auf

  // Das Bild (Meter): die Hände der Schwinger, der Bogen des Seils.
  const HALB = 2.15;               // so weit links und rechts stehen die Hände
  const SEIL_R = 1.0;              // so weit hängt das Seil in der Mitte von der Achse
  const HAND_R = 0.16;             // so gross ist der Kreis der Hände
  const ACHSE = SEIL_R + 0.02;     // die Höhe der Achse – unten streift das Seil den Boden
  const NEIGUNG = 0.34;            // wie viel von der Tiefe im Bild nach unten geht

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.feuerseil", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const TAU = Math.PI * 2;
  const mod = (a, n) => ((a % n) + n) % n;

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  // Die Umlaufzeit einer Strophe – mit Malnehmen statt Math.pow, damit jede
  // Maschine auf dieselbe Zahl kommt.
  function periodeBei(k) {
    let p = P0;
    for (let i = 0; i < k; i += 1) p *= P_FAKTOR;
    return Math.max(P_MIN, p);
  }
  const flammeBei = (k) => (k < ENDE_AB
    ? Math.min(FLAMME_MAX, FLAMME0 + FLAMME_PLUS * k)
    : FLAMME_MAX + (k - ENDE_AB + 1) * ENDE_PLUS);

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (noch kein Tipp), "spiel", "zuschauen", "ende"
  const state = {
    phase: "bereit",
    tick: 0,
    losMs: 0,
    uhrRest: 0,
    plan: { runden: [], figuren: [] },
    // Das Seil: u und w (Umdrehungen, Umdrehungen je Sekunde), der wievielte
    // Durchgang, und was in diesem schon geschah.
    seil: null,
    // Wer springt.
    y: 0,
    vy: 0,
    amBoden: true,
    gedrueckt: false,
    halt: false,
    losGesehen: false,
    haltSeit: 0,
    puffer: -1,
    scheitelTick: -1,
    scheitelHoehe: 0,
    landeTick: -1,
    absprungTick: -1,
    wartet: null,
    // Die Zahlen.
    punkte: 0,
    seile: 0,
    perfekte: 0,
    kette: 0,
    besteKette: 0,
    spruenge: 0,
    fehler: null,
    fertig: false,
    stumm: false,
    // Die Züge.
    zugNr: 0,
    zugVerlauf: [],
    // Nur fürs Bild.
    echt: 0,
    bild: null,
    teile: [],
    schriften: [],
    ansage: null,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gegner = null;
  let aufnahme = null;
  let zuschauer = null;
  let gesehenBis = -Infinity;
  let zugListe = [];
  let zugNaechster = 0;
  let zugAnker = -1;
  let zugErwartet = 0;
  let zugProtokoll = [];
  let hintergrund = null;

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, s: 60, cx: 0, boden: 0, horizont: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  // Jeder Klang hat eine Mindestpause in echter Zeit – die Prüfskripte
  // rechnen ganze Runden am Stück.
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 60) {
    if (state.stumm) return;
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }
  // Das Feuer: lauter und dichter, je höher die Flammen schlagen.
  let feuer = null;
  function feuerTakt() {
    const an = (state.phase === "spiel" || state.phase === "zuschauen") && !state.fehler;
    if (!an) { feuer?.stop(); feuer = null; return; }
    if (!feuer || !feuer.laeuft) feuer = klang()?.kulisse?.("feuerseil.feuer") || null;
    const k = clamp((flammeJetzt() - FLAMME0) / (FLAMME_MAX - FLAMME0), 0, 1);
    feuer?.setze(0.25 + 0.75 * k);
    feuer?.laut(0.45 + 0.55 * k);
  }
  function klangAus() {
    feuer?.stop();
    feuer = null;
  }
  const brumm = (muster) => { if (state.phase === "spiel" && !state.stumm) kids()?.vibrate?.(muster); };

  // ---------------------------------------------------------------------------
  // Der Plan: die Strophen
  // ---------------------------------------------------------------------------
  /*
   * Eine Strophe sind STROPHE Durchgänge des ersten Seils. Je Strophe werden
   * immer gleich viele Zahlen gezogen (sieben) – so hängt der Plan nur an der
   * Saat, nicht daran, wie weit jemand kommt.
   */
  function stropheBauen(k) {
    const z = [];
    for (let i = 0; i < 7; i += 1) z.push(zufall.zahl());
    const vorige = state.plan.figuren[k - 1] || "";
    let figur = "gleich";
    if (k >= 2) {
      const wahl = FIGUREN.filter((f) => AB_STROPHE[f] <= k && f !== vorige);
      figur = wahl[Math.min(wahl.length - 1, Math.floor(z[0] * wahl.length))];
    }
    const basis = periodeBei(k);
    const flamme = flammeBei(k);
    const zoegerTicks = (x) => Math.round((0.2 + x * 0.22) * HZ);
    for (let j = 0; j < STROPHE; j += 1) {
      const d = { strophe: k, j, figur, periode: basis, flamme, zoegern: 0, schnapp: false, kehre: false, doppel: 0 };
      if (figur === "wechsel") d.periode = basis * (j % 2 ? 0.8 : 1.22);
      else if (figur === "zeitlupe") { if (j === 2 || j === 3) d.periode = basis * 1.75; }
      else if (figur === "zoegern") { if (j === 1 || j === 3 || (k >= 9 && j === 5)) d.zoegern = zoegerTicks(z[1 + (j >> 1)]); }
      else if (figur === "schnapper") { if (j === (z[1] < 0.5 ? 1 : 2) || j === 4) d.schnapp = true; }
      else if (figur === "kehre") { if (j === 2 || (k >= 9 && j === 4)) d.kehre = true; }
      else if (figur === "doppel") { d.periode = basis * DOPPEL_LANGSAM; d.doppel = k >= 8 && z[1] < 0.5 ? 0.36 : 0.5; }
      else if (figur === "wild") {
        const x = z[1 + j];
        if (x < 0.3) d.zoegern = zoegerTicks(x / 0.3);
        else if (x < 0.55) d.schnapp = true;
        else if (x < 0.78) d.periode = basis * 1.35;
      }
      state.plan.runden.push(d);
    }
    state.plan.figuren.push(figur);
  }

  function planBis(runde) {
    while (state.plan.runden.length <= runde) stropheBauen(state.plan.figuren.length);
  }
  const rundeBei = (n) => { planBis(n); return state.plan.runden[n]; };

  // Die gewürfelte Welt in Worten (für die Prüfung): die Figuren der ersten
  // vierzehn Strophen, bei «doppel» mit dem Versatz.
  function weltText() {
    planBis(14 * STROPHE);
    return state.plan.figuren.slice(0, 14).map((f, k) => {
      const d = state.plan.runden[k * STROPHE];
      const zoegern = state.plan.runden.slice(k * STROPHE, (k + 1) * STROPHE).map((r) => r.zoegern).filter(Boolean).join("/");
      return f + (d.doppel ? `:${d.doppel}` : "") + (zoegern ? `:${zoegern}` : "");
    }).join(" ");
  }

  // ---------------------------------------------------------------------------
  // Das Seil
  // ---------------------------------------------------------------------------
  const neuesSeil = () => ({
    u: START_U, w: 0, n: 0, richtung: 1, zoegern: 0, schnapp: false, oben: false, zweit: false, versatz: 0.5,
  });

  /*
   * Ein Schritt des Seils. Gibt zurück, was dabei geschah: 1 – das erste
   * Seil ging unten durch, 2 – das zweite, 4 – das zweite zündet, 8 – es
   * erlischt, 16 – eine Kehre beginnt, 32 – es zögert, 64 – es schnappt.
   * Hängt an nichts als am Seil selbst und am Plan – darum lässt sich damit
   * auch vorausrechnen (vorschau).
   */
  function seilSchritt(s) {
    const d = rundeBei(s.n);
    let ziel = s.richtung / d.periode;
    if (s.zoegern > 0) { ziel *= ZOEGER_REST; s.zoegern -= 1; }
    else if (s.schnapp) ziel *= SCHNAPP;
    s.w += (ziel - s.w) * NACHZUG;
    const alt = s.u;
    s.u += s.w * TAKT;
    let was = 0;
    // Oben: Dort geschieht, was die Runde vorhat – einmal je Durchgang.
    if (!s.oben && Math.floor(alt + 0.5) !== Math.floor(s.u + 0.5)) {
      s.oben = true;
      if (d.kehre) { s.richtung = -s.richtung; was |= 16; }
      if (d.zoegern) { s.zoegern = d.zoegern; was |= 32; }
      if (d.schnapp) { s.schnapp = true; was |= 64; }
    }
    // Das zweite Seil hängt am ersten: versatz − u.
    if (s.zweit && Math.floor(s.versatz - alt) !== Math.floor(s.versatz - s.u)) was |= 2;
    // Unten: der Durchgang – und der nächste beginnt.
    if (Math.floor(alt) !== Math.floor(s.u)) {
      was |= 1;
      s.n += 1;
      s.oben = false;
      s.schnapp = false;
      s.zoegern = 0;
      const neu = rundeBei(s.n);
      if (neu.doppel && !s.zweit) { s.zweit = true; s.versatz = neu.doppel; was |= 4; }
      else if (!neu.doppel && s.zweit) { s.zweit = false; was |= 8; }
    }
    return was;
  }

  // Die Flammenhöhe, die jetzt gilt.
  const flammeJetzt = () => (state.seil ? rundeBei(state.seil.n).flamme : FLAMME0);

  /*
   * Die nächsten Durchgänge, vorausgerechnet: [{ tick, seil, flamme }]. Für
   * die Prüfskripte und die Vorführung – das Seil hängt nicht daran, was
   * jemand tut.
   */
  function vorschau(anzahl = 2, hoechstens = HZ * 6) {
    const s = { ...state.seil };
    const raus = [];
    for (let i = 1; i <= hoechstens && raus.length < anzahl; i += 1) {
      const vorher = s.n;
      const was = seilSchritt(s);
      if (was & 1) raus.push({ tick: state.tick + i, seil: 0, flamme: rundeBei(vorher).flamme });
      if (was & 2) raus.push({ tick: state.tick + i, seil: 1, flamme: rundeBei(vorher).flamme });
    }
    return raus;
  }

  /*
   * Ein Sprung allein, vorausgerechnet: Wer haltTicks Schritte hält, ist ab
   * Schritt «ab» bis Schritt «bis» (seit dem Tipp) mindestens «hoehe» über
   * dem Boden, im Scheitel «gipfel» hoch, und landet nach «luft» Schritten.
   */
  function sprungProfil(haltTicks, hoehe = 0) {
    let y = 0;
    let vy = V0;
    let ab = -1;
    let bis = -1;
    let scheitel = -1;
    let gipfel = 0;
    for (let i = 1; i < HZ * 2; i += 1) {
      const haelt = vy > 0 && i <= Math.max(HALT_MIN, haltTicks);
      vy -= (vy > 0 && !haelt ? G * SCHNITT : G) * TAKT;
      y += vy * TAKT;
      if (scheitel < 0 && vy <= 0) scheitel = i;
      if (y > gipfel) gipfel = y;
      if (y <= 0) return { ab, bis, scheitel, gipfel, luft: i };
      if (y >= hoehe) { if (ab < 0) ab = i; bis = i; }
    }
    return { ab, bis, scheitel, gipfel, luft: HZ * 2 };
  }

  // ---------------------------------------------------------------------------
  // Der Sprung
  // ---------------------------------------------------------------------------
  function absprung() {
    const st = state;
    st.amBoden = false;
    st.vy = V0;
    st.halt = true;
    st.losGesehen = !st.gedrueckt;
    st.haltSeit = st.tick;
    st.absprungTick = st.tick;
    st.scheitelTick = -1;
    st.scheitelHoehe = 0;
    st.puffer = -1;
    st.spruenge += 1;
    if (!st.stumm) {
      st.bild.absprung = st.echt;
      staub(0, 4);
      ton("feuerseil.sprung", { laut: 0.5 }, 90);
    }
  }

  // Drücken: am Boden der Absprung, in der Luft ein Tipp auf Vorrat.
  function druck() {
    const st = state;
    if (st.fehler || st.gedrueckt) return false;
    st.gedrueckt = true;
    if (st.amBoden) absprung();
    else st.puffer = st.tick;
    return true;
  }

  function los() {
    const st = state;
    if (st.fehler || !st.gedrueckt) return false;
    st.gedrueckt = false;
    st.losGesehen = true;
    return true;
  }

  function springerSchritt() {
    const st = state;
    if (st.amBoden) return;
    if (st.halt && st.losGesehen && st.tick - st.haltSeit >= HALT_MIN) st.halt = false;
    const stieg = st.vy > 0;
    st.vy -= (stieg && !st.halt ? G * SCHNITT : G) * TAKT;
    st.y += st.vy * TAKT;
    if (st.y > st.scheitelHoehe) st.scheitelHoehe = st.y;
    if (stieg && st.vy <= 0) {
      st.scheitelTick = st.tick;
      st.halt = false;
      // Ein Seil, das kurz vor dem Scheitel durchging, war perfekt.
      if (st.wartet) wertung(st.tick - st.wartet.tick <= PERFEKT);
    }
    if (st.y <= 0) {
      st.y = 0;
      st.vy = 0;
      st.amBoden = true;
      st.landeTick = st.tick;
      if (!st.stumm) { st.bild.landung = st.echt; staub(0, 5); }
      if (st.puffer >= 0 && st.tick - st.puffer <= PUFFER) absprung();
      st.puffer = -1;
    }
  }

  // ---------------------------------------------------------------------------
  // Der Durchgang
  // ---------------------------------------------------------------------------
  // Ob der Durchgang, der noch auf den Scheitel wartete, perfekt war.
  function wertung(perfekt) {
    const st = state;
    const w = st.wartet;
    st.wartet = null;
    if (!w) return;
    if (!perfekt) { st.kette = 0; return; }
    st.kette += 1;
    st.perfekte += 1;
    st.besteKette = Math.max(st.besteKette, st.kette);
    const bonus = Math.min(st.kette, KETTE_MAX);
    st.punkte += bonus;
    if (st.stumm) return;
    setzeZahl();
    // Immer nur eine: Mit zwei Seilen kommen sie dicht hintereinander.
    state.schriften = state.schriften.filter((t) => !t.perfekt);
    schrift(st.kette >= 2 ? `Perfekt ×${st.kette}! +${bonus + 1}` : `Perfekt! +${bonus + 1}`, 0, st.y + 1.62, "#ffd23f", 20, 1.1);
    state.schriften[state.schriften.length - 1].perfekt = true;
    sterne(0, st.y + 0.1, 8 + 2 * bonus);
    st.bild.perfekt = st.echt;
    ton("perfekt", { laut: 0.7 }, 160);
    brumm([8, 24, 10]);
  }

  function durchgang(nr, flamme) {
    const st = state;
    if (st.wartet) wertung(false);
    if (st.amBoden || st.y < flamme) { getroffen(nr, flamme); return; }
    st.punkte += 1;
    st.seile += 1;
    // Nach dem Scheitel steht es gleich fest; davor wartet es auf ihn.
    if (st.vy <= 0 && st.scheitelTick >= 0) {
      st.wartet = { tick: st.tick, nr };
      wertung(st.tick - st.scheitelTick <= PERFEKT);
    } else {
      st.wartet = { tick: st.tick, nr };
    }
    if (st.stumm) return;
    setzeZahl();
    funken(0, 0.04, 9, nr);
    st.bild.durch = st.echt;
    ton("feuerseil.seil", { laut: 0.45 + 0.4 * clamp(Math.abs(st.seil.w) / 2.6, 0, 1) }, 70);
  }

  // Warum es nicht gereicht hat – für die Tafel.
  function grundVon(flamme) {
    const st = state;
    if (st.amBoden) {
      // Eben erst gelandet: zu früh gesprungen. Sonst gar nicht oder zu spät.
      return st.landeTick >= 0 && st.tick - st.landeTick < HZ * 0.3 && st.absprungTick >= 0 ? "frueh" : "spaet";
    }
    if (st.vy > 0) return "spaet";
    return st.scheitelHoehe < flamme ? "flach" : "frueh";
  }

  function getroffen(nr, flamme) {
    const st = state;
    st.fehler = { tick: st.tick, nr, flamme, grund: grundVon(flamme), y: st.y };
    st.kette = 0;
    if (st.stumm) return;
    st.bild.treffer = st.echt;
    funken(0, st.y + 0.05, 26, nr);
    rauch(0, st.y + 0.1, 10);
    schrift("Autsch!", 0, st.y + 1.7, "#ff7a6b", 28, 1.6);
    ton("feuerseil.treffer", { laut: 0.9 }, 300);
    ton("fehler", { verzoegerung: 0.18 }, 300);
    brumm([30, 40, 60]);
    if (st.phase === "spiel") {
      meldeZug(ZUG_ENDE);
      clearStep();
      stepTimer = window.setTimeout(finish, 1500);
    }
  }

  // ---------------------------------------------------------------------------
  // Ein Schritt der Runde
  // ---------------------------------------------------------------------------
  function simSchritt() {
    const st = state;
    if (st.fehler) return;
    springerSchritt();
    if (st.wartet && st.tick - st.wartet.tick > PERFEKT) wertung(false);
    const vorher = st.seil.n;
    const was = seilSchritt(st.seil);
    st.tick += 1;
    if (!was) return;
    const flamme = rundeBei(vorher).flamme;
    if (was & 1) durchgang(0, flamme);
    if ((was & 2) && !st.fehler) durchgang(1, flamme);
    if (st.stumm) return;
    if (was & 1) {
      const d = rundeBei(st.seil.n);
      if (d.j === 0 && d.strophe > 0) neueStrophe(d);
    }
    if (was & 4) { st.bild.zuenden = st.echt; ton("feuerseil.zuenden", { laut: 0.8 }, 200); }
    if (was & 8) st.bild.loeschen = st.echt;
    if (was & 16) st.bild.kehre = st.echt;
  }

  function neueStrophe(d) {
    const text = ANSAGE[d.figur];
    state.ansage = { text: text || `Stufe ${d.strophe + 1}`, klein: text ? `Stufe ${d.strophe + 1}` : "", seit: state.echt };
  }

  function simZuruecksetzen() {
    const st = state;
    st.tick = 0;
    st.seil = neuesSeil();
    st.y = 0;
    st.vy = 0;
    st.amBoden = true;
    st.gedrueckt = false;
    st.halt = false;
    st.losGesehen = false;
    st.haltSeit = 0;
    st.puffer = -1;
    st.scheitelTick = -1;
    st.scheitelHoehe = 0;
    st.landeTick = -1;
    st.absprungTick = -1;
    st.wartet = null;
    st.punkte = 0;
    st.seile = 0;
    st.perfekte = 0;
    st.kette = 0;
    st.besteKette = 0;
    st.spruenge = 0;
    st.fehler = null;
  }

  // ---------------------------------------------------------------------------
  // Die Züge: aufzeichnen, melden, nachbauen
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug) – sofort, bei jedem
   * Drücken und Loslassen:
   *
   *   a   der Schritt, in dem es geschah
   *   c   die laufende Nummer × 8 + was: 0 Start, 1 Drücken, 2 Loslassen,
   *       5 das Ende
   *   b   im Multiplayer die bis zu sechs Züge davor, wenn sie höchstens 15
   *       Schritte zurückliegen: je 1 + was + 8 × wie viele Schritte davor,
   *       in Stellen zu 256. Dort werden Züge, die innert 40 ms kommen, zu
   *       einem (live-spiel.js, zug) – ein kurzer Tipp ist Drücken und
   *       Loslassen in dieser Zeit. In der Aufzeichnung für die Hall of
   *       Fame fehlt keiner; dort ist b null.
   *   p   die Punkte bis dahin
   */
  function meldeZug(was) {
    if (state.phase === "zuschauen" || state.stumm) return;
    const T = state.tick;
    let b = 0;
    let stelle = 1;
    for (let i = 1; i <= ZUG_VORHER; i += 1) {
      const e = state.zugVerlauf[state.zugVerlauf.length - i];
      if (!e || T - e.tick > 15) break;
      b += (1 + e.was + 8 * (T - e.tick)) * stelle;
      stelle *= 256;
    }
    const ort = { a: T, b, c: state.zugNr * 8 + was };
    zugProtokoll.push({ t: Math.round(T / (HZ / 1000)), ...ort, p: state.punkte });
    state.zugVerlauf.push({ tick: T, was });
    if (state.zugVerlauf.length > ZUG_VORHER) state.zugVerlauf.shift();
    state.zugNr += 1;
    aufnahme?.zug(state.punkte, { ...ort, b: 0 });
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, ort);
  }

  // Eine Eingabe im Spiel: rechnen und melden.
  function eingabe(runter) {
    const zaehlt = runter ? druck() : los();
    if (zaehlt) meldeZug(runter ? ZUG_DRUCK : ZUG_LOS);
  }

  // Ein Zug des anderen, im selben Schritt.
  function zugAnwenden(e) {
    if (e.was === ZUG_DRUCK) druck();
    else if (e.was === ZUG_LOS) los();
  }

  // Ein angekommener Zug, und die, die ihm im Multiplayer verloren gingen
  // (aus b, falls sie dicht davor lagen).
  function zugAuspacken(z) {
    const nr = Math.floor(z.c / 8);
    const was = mod(z.c, 8);
    const raus = [];
    if (nr > zugErwartet) {
      const fehlen = nr - zugErwartet;
      const vorher = [];
      let rest = Math.max(0, Math.round(z.b || 0));
      for (let i = 1; i <= ZUG_VORHER && rest > 0; i += 1) {
        const code = rest % 256;
        rest = Math.floor(rest / 256);
        if (!code) break;
        vorher.push({ was: (code - 1) % 8, a: z.a - Math.floor((code - 1) / 8) });
      }
      for (let i = Math.min(fehlen, vorher.length); i >= 1; i -= 1) {
        const v = vorher[i - 1];
        raus.push({ nr: nr - i, was: v.was, a: v.a, t: z.t });
      }
    }
    if (nr >= zugErwartet) {
      raus.push({ nr, was, a: z.a, t: z.t, p: z.p });
      zugErwartet = nr + 1;
    }
    return raus;
  }

  // Die Züge, die in diesem Schritt dran sind.
  function zuegeAnwenden() {
    while (zugNaechster < zugListe.length && zugListe[zugNaechster].a <= state.tick) {
      zugAnwenden(zugListe[zugNaechster]);
      zugNaechster += 1;
    }
  }

  // Kam ein Zug zu spät (sein Schritt ist hier schon vorbei), baut die Runde
  // sich still von vorn bis hierher neu – mit allen Zügen, die es gibt.
  function neuAufbauen() {
    const bis = state.tick;
    state.stumm = true;
    simZuruecksetzen();
    zugNaechster = 0;
    while (state.tick < bis && !state.fehler) {
      zuegeAnwenden();
      simSchritt();
    }
    state.stumm = false;
    // War der Treffer schon vorbei, steht er jetzt ohne Funken da.
    if (state.fehler) state.bild.treffer = state.echt - 5;
  }

  /*
   * Jedes Bild beim Zuschauen: die Züge, die inzwischen da sind (beim
   * Anschauen aus der Hall of Fame alle, im Multiplayer, was angekommen
   * ist), und so viele Schritte, wie der andere zu dieser Zeit gespielt hatte
   * – geschätzt vom letzten Zug aus, der schon vorbei ist.
   */
  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetztMs = zuschauer.jetzt();
    let spaet = false;
    for (const z of zuschauer.seit(gesehenBis, Infinity)) {
      gesehenBis = z.t;
      for (const e of zugAuspacken(z)) {
        zugListe.push(e);
        if (e.a < state.tick) spaet = true;
      }
    }
    if (spaet) {
      zugListe.sort((x, y) => x.nr - y.nr);
      neuAufbauen();
    }
    while (zugAnker + 1 < zugListe.length && zugListe[zugAnker + 1].t <= jetztMs) zugAnker += 1;
    const anker = zugListe[zugAnker];
    const verzug = zuschauer.live ? 60 : 4;
    const proMs = HZ / 1000;
    let ziel = Math.floor(anker ? anker.a + (jetztMs - anker.t) * proMs : jetztMs * proMs) - verzug;
    // Über das Ende hinaus rechnet niemand: Der letzte Zug ist der Treffer.
    const ende = zugListe.find((e) => e.was === ZUG_ENDE);
    if (ende) ziel = Math.min(ziel, ende.a);
    for (let n = 0; n < 2400 && state.tick < ziel && !state.fehler; n += 1) {
      zuegeAnwenden();
      simSchritt();
    }
    if (!state.fehler) zuegeAnwenden();
    setzeZahl();
    // Eine Runde aus der Hall of Fame: am Schluss die Tafel.
    zuschauer.weiter?.();
  }

  // Ab jetzt die Runde des anderen: von vorn, mit derselben Welt (dieselbe
  // Saat), und dann Zug um Zug, wie er gespielt hat.
  function zuschauenStarten() {
    if (!zuschauer?.seit) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    gesehenBis = -Infinity;
    zugListe = [];
    zugNaechster = 0;
    zugAnker = -1;
    zugErwartet = 0;
    zuschauer.los?.();
    zuschauenTakt();
  }

  // ---------------------------------------------------------------------------
  // Teilchen und Schriften
  // ---------------------------------------------------------------------------
  const FARBEN_FEUER = ["#fff3c4", "#ffd23f", "#ff9f1c", "#ff6b2c"];
  const FARBEN_BLAU = ["#e9fbff", "#9fe8ff", "#4cc3ff", "#3d7bff"];

  function teil(o) {
    if (state.teile.length > 220) state.teile.shift();
    state.teile.push(o);
  }

  // Funken, wo das Seil den Boden streift.
  function funken(x, y, anzahl, nr = 0) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const farben = nr === 1 ? FARBEN_BLAU : FARBEN_FEUER;
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.PI * (0.08 + Math.random() * 0.84);
      const v = 1.2 + Math.random() * 3.4;
      teil({ art: "funke", x: x + (Math.random() - 0.5) * 0.5, y, vx: Math.cos(w) * v * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(w) * v, r: 0.018 + Math.random() * 0.022, farbe: farben[Math.floor(Math.random() * farben.length)], leben: 0.35 + Math.random() * 0.4, max: 0.75 });
    }
  }
  function sterne(x, y, anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    for (let i = 0; i < anzahl; i += 1) {
      const w = Math.random() * TAU;
      const v = 1.4 + Math.random() * 2.2;
      teil({ art: "stern", x: x + Math.cos(w) * 0.25, y: y + 0.05, vx: Math.cos(w) * v, vy: Math.abs(Math.sin(w)) * v * 0.8 + 0.6, r: 0.012 + Math.random() * 0.014, farbe: Math.random() < 0.5 ? "#ffd23f" : "#fff3c4", leben: 0.4 + Math.random() * 0.35, max: 0.75 });
    }
  }
  function staub(x, anzahl) {
    if (ruhig()) return;
    for (let i = 0; i < anzahl; i += 1) {
      const seite = Math.random() < 0.5 ? -1 : 1;
      teil({ art: "staub", x: x + seite * (0.08 + Math.random() * 0.1), y: 0.02, vx: seite * (0.4 + Math.random() * 0.9), vy: 0.2 + Math.random() * 0.5, r: 0.05 + Math.random() * 0.05, farbe: "#cbb9a8", leben: 0.3 + Math.random() * 0.25, max: 0.55 });
    }
  }
  function rauch(x, y, anzahl) {
    for (let i = 0; i < anzahl; i += 1) {
      teil({ art: "rauch", x: x + (Math.random() - 0.5) * 0.3, y, vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * 0.9, r: 0.08 + Math.random() * 0.1, farbe: "#9a9aa6", leben: 0.9 + Math.random() * 0.8, max: 1.7 });
    }
  }
  function schrift(text, x, y, farbe, gross, dauer = 1.2) {
    if (state.schriften.length > 6) state.schriften.shift();
    state.schriften.push({ text, x, y, farbe, gross, leben: dauer, max: dauer });
  }

  function effekte(dt) {
    state.echt += dt;
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.art === "funke" || t.art === "stern") t.vy -= 7 * dt;
      else { t.vx *= 1 - 2 * dt; t.vy *= 1 - 1.2 * dt; }
      if (t.y < 0 && (t.art === "funke" || t.art === "stern")) { t.y = 0; t.vy = Math.abs(t.vy) * 0.3; }
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    if (state.ansage && state.echt - state.ansage.seit > 1.7) state.ansage = null;
    // Glut steigt vom Seil auf – mehr, je höher die Flammen schlagen.
    if (!ruhig() && !state.fehler && (state.phase === "spiel" || state.phase === "zuschauen") && Math.random() < dt * (10 + flammeJetzt() * 60)) {
      const lagen = seilLage();
      const lage = lagen[Math.floor(Math.random() * lagen.length)];
      const p = seilPunkt(-0.9 + Math.random() * 1.8, lage.u);
      const farben = lage.nr === 1 ? FARBEN_BLAU : FARBEN_FEUER;
      teil({ art: "glut", x: p.x, y: p.y - p.z * NEIGUNG + 0.05, vx: (Math.random() - 0.5) * 0.5, vy: 0.5 + Math.random() * 0.9, r: 0.012 + Math.random() * 0.014, farbe: farben[1 + Math.floor(Math.random() * 3)], leben: 0.5 + Math.random() * 0.7, max: 1.2 });
    }
    // Der Zopf hängt dem Kopf nach.
    const b = state.bild;
    const ziel = state.y;
    b.zopfV += ((ziel - b.zopf) * 90 - b.zopfV * 11) * dt;
    b.zopf += b.zopfV * dt;
    feuerTakt();
  }

  const neuesBild = () => ({
    absprung: -9, landung: -9, durch: -9, perfekt: -9, treffer: -9, zuenden: -9, loeschen: -9, kehre: -9,
    zopf: 0, zopfV: 0,
  });

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "fe-platz");
    feld = shell.el("div", "fe-feld");
    canvas = document.createElement("canvas");
    canvas.className = "fe-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    // Der Hinweis vor dem ersten Tipp: ein Finger, der tippt.
    const tipp = shell.el("span", "fe-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", "32");
    ring.setAttribute("cy", "32");
    ring.setAttribute("r", "22");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "#ffffff");
    ring.setAttribute("stroke-width", "4");
    ring.setAttribute("class", "fe-tipp-ring");
    const punkt = document.createElementNS(ns, "circle");
    punkt.setAttribute("cx", "32");
    punkt.setAttribute("cy", "32");
    punkt.setAttribute("r", "9");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(ring, punkt);
    tipp.append(svg);
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    // Die Welt: gut fünfeinhalb Meter breit (die Schwinger aussen), oben
    // drei Meter Luft über dem Pflaster, unten ein Meter Platz davor.
    const nutzH = cssH - frei;
    view.s = Math.min(cssW / 5.7, nutzH / 4.4);
    view.cx = cssW / 2;
    view.boden = frei + (nutzH - 4.4 * view.s) / 2 + 3.3 * view.s;
    view.horizont = view.boden - 0.62 * view.s;
    hintergrund = null;
  }

  // Von der Welt ins Bild: x nach rechts, y nach oben, z auf die Kamera zu.
  const bx = (x, z = 0) => view.cx + x * view.s * (1 + z * 0.035);
  const by = (y, z = 0) => view.boden - y * view.s + z * NEIGUNG * view.s;

  // ---------------------------------------------------------------------------
  // Der Hintergrund: einmal gemalt, bis sich die Fläche ändert
  // ---------------------------------------------------------------------------
  function hintergrundBauen() {
    const c = document.createElement("canvas");
    c.width = Math.round(view.cssW * view.dpr);
    c.height = Math.round(view.cssH * view.dpr);
    const h = c.getContext("2d");
    h.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const W = view.cssW;
    const H = view.cssH;
    const S = view.s;
    const hz = view.horizont;

    // Der Himmel.
    const himmel = h.createLinearGradient(0, 0, 0, hz);
    himmel.addColorStop(0, "#050716");
    himmel.addColorStop(0.55, "#111634");
    himmel.addColorStop(1, "#2b2147");
    h.fillStyle = himmel;
    h.fillRect(0, 0, W, hz + 1);
    // Sterne – dichter, wo der Himmel dunkel ist.
    for (let i = 0; i < 150; i += 1) {
      const x = hash01(i * 3.1 + 1) * W;
      const y = hash01(i * 7.7 + 2) * hz * 0.82;
      const r = 0.4 + hash01(i * 1.3 + 5) * 1.1;
      h.globalAlpha = (0.25 + hash01(i * 9.1) * 0.7) * (1 - (y / hz) * 0.6);
      h.fillStyle = hash01(i * 4.4) < 0.2 ? "#ffe9c4" : "#dfe6ff";
      h.beginPath();
      h.arc(x, y, r, 0, TAU);
      h.fill();
    }
    h.globalAlpha = 1;
    // Der Mond: eine Sichel mit Hof.
    const mx = W * 0.8;
    const my = Math.max(view.frei + S * 0.5, hz - S * 3.5);
    const mr = clamp(S * 0.24, 10, 34);
    const hof = h.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4.5);
    hof.addColorStop(0, "rgba(220, 228, 255, 0.22)");
    hof.addColorStop(1, "rgba(220, 228, 255, 0)");
    h.fillStyle = hof;
    h.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    h.fillStyle = "#f3f0dc";
    h.beginPath();
    h.arc(mx, my, mr, 0, TAU);
    h.fill();
    h.fillStyle = "#0b0f26";
    h.beginPath();
    h.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.92, 0, TAU);
    h.fill();

    // Die Berge: zwei Ketten, die hintere heller, mit etwas Schnee.
    const kette = (basis, hoch, farbe, saat, schnee) => {
      const punkte = [];
      const n = 26;
      for (let i = 0; i <= n; i += 1) {
        const k = i / n;
        const zack = hash01(saat + i * 1.7) * 0.55 + hash01(saat + i * 0.31) * 0.45;
        const berg = Math.sin(k * Math.PI * (1.3 + hash01(saat) * 1.2) + saat) * 0.5 + 0.5;
        punkte.push([k * W, basis - hoch * (0.25 + 0.75 * berg) * (0.55 + 0.45 * zack)]);
      }
      h.fillStyle = farbe;
      h.beginPath();
      h.moveTo(0, hz + 2);
      punkte.forEach(([x, y]) => h.lineTo(x, y));
      h.lineTo(W, hz + 2);
      h.closePath();
      h.fill();
      if (!schnee) return;
      h.fillStyle = schnee;
      for (let i = 1; i < n; i += 1) {
        const [x, y] = punkte[i];
        if (y > punkte[i - 1][1] || y > punkte[i + 1][1] || y > basis - hoch * 0.62) continue;
        const b = W / n;
        h.beginPath();
        h.moveTo(x, y);
        h.lineTo(x - b * 0.45, y + hoch * 0.16);
        h.lineTo(x - b * 0.12, y + hoch * 0.1);
        h.lineTo(x + b * 0.1, y + hoch * 0.17);
        h.lineTo(x + b * 0.42, y + hoch * 0.13);
        h.closePath();
        h.fill();
      }
    };
    kette(hz, S * 2.5, "#1c2147", 3.3, "rgba(200, 210, 255, 0.28)");
    kette(hz, S * 1.55, "#151833", 8.1, null);

    // Die Häuser am Platz: Giebel, ein Kirchturm, warme Fenster.
    const hausB = clamp(S * 0.95, 46, 190);
    const anzahl = Math.ceil(W / hausB) + 1;
    for (let i = 0; i < anzahl; i += 1) {
      const x = (i - 0.3) * hausB + hash01(i * 2.2) * hausB * 0.1;
      const b = hausB * (0.86 + hash01(i * 5.1) * 0.22);
      const hoch = S * (0.75 + hash01(i * 3.7) * 0.6);
      const dach = S * (0.3 + hash01(i * 6.3) * 0.25);
      const turm = i === Math.floor(anzahl * 0.28);
      h.fillStyle = hash01(i * 8.3) < 0.5 ? "#17142a" : "#1b1830";
      h.fillRect(x, hz - hoch, b, hoch + 2);
      h.fillStyle = "#100e1f";
      h.beginPath();
      h.moveTo(x - b * 0.06, hz - hoch);
      h.lineTo(x + b / 2, hz - hoch - dach);
      h.lineTo(x + b * 1.06, hz - hoch);
      h.closePath();
      h.fill();
      if (turm) {
        const tb = b * 0.34;
        const th = hoch + dach + S * 0.9;
        h.fillStyle = "#17142a";
        h.fillRect(x + b * 0.33, hz - th, tb, th);
        h.fillStyle = "#100e1f";
        h.beginPath();
        h.moveTo(x + b * 0.33 - tb * 0.12, hz - th);
        h.lineTo(x + b * 0.33 + tb / 2, hz - th - S * 0.75);
        h.lineTo(x + b * 0.33 + tb * 1.12, hz - th);
        h.closePath();
        h.fill();
        h.fillStyle = "#ffe2a0";
        h.beginPath();
        h.arc(x + b * 0.33 + tb / 2, hz - th + tb * 0.75, tb * 0.26, 0, TAU);
        h.fill();
      }
      // Fenster: zwei Reihen, manche dunkel.
      const fb = b * 0.13;
      const fh = hoch * 0.17;
      for (let r = 0; r < 2; r += 1) {
        for (let s = 0; s < 3; s += 1) {
          const an = hash01(i * 13.1 + r * 3.3 + s * 1.9) < 0.62;
          h.fillStyle = an ? (hash01(i + s * 7.7) < 0.5 ? "#ffcf7a" : "#ffb45c") : "#0c0a18";
          h.globalAlpha = an ? 0.9 : 0.8;
          h.fillRect(x + b * (0.16 + s * 0.27), hz - hoch * (0.82 - r * 0.36), fb, fh);
        }
      }
      h.globalAlpha = 1;
    }

    // Das Publikum: Köpfe und Schultern vor den Häusern, vom Feuer gesäumt.
    const kopf = clamp(S * 0.085, 4, 15);
    for (let i = 0; i < Math.ceil(W / (kopf * 2.5)) + 1; i += 1) {
      const x = i * kopf * 2.5 + hash01(i * 4.9) * kopf;
      const gross = 0.82 + hash01(i * 2.7) * 0.4;
      const y = hz - kopf * 3.3 * gross + hash01(i * 6.1) * kopf * 0.6;
      h.fillStyle = "#0b0916";
      h.beginPath();
      h.arc(x, y, kopf * gross, 0, TAU);
      h.fill();
      h.beginPath();
      h.ellipse(x, y + kopf * 2.6 * gross, kopf * 1.7 * gross, kopf * 2.1 * gross, 0, 0, TAU);
      h.fill();
      h.strokeStyle = "rgba(255, 150, 70, 0.3)";
      h.lineWidth = 1.2;
      h.beginPath();
      h.arc(x, y, kopf * gross, Math.PI * 1.1, Math.PI * 1.9);
      h.stroke();
    }

    // Das Pflaster: dunkel, nach vorn heller, mit Fugen in Reihen.
    const boden = h.createLinearGradient(0, hz, 0, H);
    boden.addColorStop(0, "#1a1622");
    boden.addColorStop(0.35, "#241d28");
    boden.addColorStop(1, "#15111a");
    h.fillStyle = boden;
    h.fillRect(0, hz, W, H - hz);
    h.strokeStyle = "rgba(0, 0, 0, 0.3)";
    h.lineWidth = 1;
    let reihe = 0;
    for (let y = hz + 3; y < H; reihe += 1) {
      const dicke = 3 + (y - hz) * 0.085;
      h.beginPath();
      h.moveTo(0, y);
      h.lineTo(W, y);
      h.stroke();
      const breit = dicke * 2.3;
      for (let x = (reihe % 2) * breit * 0.5 - breit; x < W + breit; x += breit) {
        const xx = view.cx + (x - view.cx) * (0.7 + (y - hz) / (H - hz + 1) * 0.5);
        h.beginPath();
        h.moveTo(xx, y);
        h.lineTo(xx + (xx - view.cx) * 0.012, y + dicke);
        h.stroke();
      }
      y += dicke;
    }

    // Die Lichterketten: zwei Bögen über dem Platz, bunte Birnen.
    const birnen = ["#ffd23f", "#ff7a6b", "#7fe0ff", "#9ff5bd", "#ffb3f0"];
    const bogen = (x0, y0, x1, y1, durchhang, saat) => {
      h.strokeStyle = "rgba(10, 8, 20, 0.9)";
      h.lineWidth = 1.2;
      h.beginPath();
      const n = Math.max(8, Math.round(Math.abs(x1 - x0) / clamp(S * 0.4, 18, 46)));
      for (let i = 0; i <= n; i += 1) {
        const k = i / n;
        const x = lerp(x0, x1, k);
        const y = lerp(y0, y1, k) + durchhang * 4 * k * (1 - k);
        if (i === 0) h.moveTo(x, y); else h.lineTo(x, y);
      }
      h.stroke();
      for (let i = 1; i < n; i += 1) {
        const k = i / n;
        const x = lerp(x0, x1, k);
        const y = lerp(y0, y1, k) + durchhang * 4 * k * (1 - k) + 3;
        const farbe = birnen[(i + saat) % birnen.length];
        const r = clamp(S * 0.035, 2, 5);
        const schein = h.createRadialGradient(x, y, 0, x, y, r * 4);
        schein.addColorStop(0, farbe);
        schein.addColorStop(0.25, farbe);
        schein.addColorStop(1, "rgba(0, 0, 0, 0)");
        h.globalAlpha = 0.5;
        h.fillStyle = schein;
        h.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
        h.globalAlpha = 1;
        h.fillStyle = farbe;
        h.beginPath();
        h.arc(x, y, r, 0, TAU);
        h.fill();
      }
    };
    const kettenY = hz - S * 2.75;
    bogen(-10, kettenY - S * 0.2, W * 0.5, kettenY + S * 0.05, S * 0.22, 0);
    bogen(W * 0.5, kettenY + S * 0.05, W + 10, kettenY - S * 0.3, S * 0.24, 2);

    return c;
  }

  // ---------------------------------------------------------------------------
  // Die Flammen: drei Bilder, einmal gemalt
  // ---------------------------------------------------------------------------
  const flammenBilder = new Map();
  function flammenBild(art) {
    if (flammenBilder.has(art)) return flammenBilder.get(art);
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 128;
    const h = c.getContext("2d");
    const farben = {
      feuer: ["rgba(255, 250, 220, 1)", "rgba(255, 196, 60, 0.85)", "rgba(255, 110, 30, 0.45)", "rgba(200, 40, 10, 0)"],
      heiss: ["rgba(255, 255, 255, 1)", "rgba(255, 232, 150, 0.9)", "rgba(255, 150, 60, 0.5)", "rgba(230, 60, 30, 0)"],
      blau: ["rgba(240, 252, 255, 1)", "rgba(130, 220, 255, 0.85)", "rgba(60, 130, 255, 0.45)", "rgba(40, 40, 200, 0)"],
    }[art];
    // Ein Tropfen: unten rund und hell, nach oben spitz und durchsichtig.
    const verlauf = h.createRadialGradient(32, 100, 2, 32, 86, 44);
    farben.forEach((f, i) => verlauf.addColorStop(i / (farben.length - 1), f));
    h.fillStyle = verlauf;
    h.beginPath();
    h.moveTo(32, 2);
    h.bezierCurveTo(44, 46, 60, 76, 58, 100);
    h.bezierCurveTo(56, 122, 8, 122, 6, 100);
    h.bezierCurveTo(4, 76, 20, 46, 32, 2);
    h.fill();
    flammenBilder.set(art, c);
    return c;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Das Flackern: nie ganz gleich, nie zufällig von Bild zu Bild.
  const flackern = (n = 0) => (ruhig() ? 0.9 : 0.82 + 0.1 * Math.sin(state.echt * 23 + n * 2.1) + 0.08 * Math.sin(state.echt * 37.3 + n * 5.3));

  // Ein Punkt des Seils: s von −1 (linke Hand) bis 1 (rechte), u die Lage.
  function seilPunkt(s, u) {
    const r = HAND_R + (SEIL_R - HAND_R) * (1 - Math.pow(Math.abs(s), 2.3));
    const th = TAU * u;
    return { x: s * HALB, y: ACHSE - r * Math.cos(th), z: -r * Math.sin(th) };
  }

  // Wo welches Seil gerade ist – beim Spielen aus der Rechnung, davor ein
  // leises Pendeln knapp hinter den Füssen.
  function seilLage() {
    const s = state.seil;
    if (state.phase === "bereit") return [{ nr: 0, u: START_U + (ruhig() ? 0 : Math.sin(state.echt * 1.9) * 0.022), w: 0 }];
    const raus = [{ nr: 0, u: s.u, w: s.w }];
    if (s.zweit) raus.push({ nr: 1, u: s.versatz - s.u, w: -s.w });
    return raus;
  }

  function zeichneSeil(lage, vorn) {
    const z0 = -Math.sin(TAU * lage.u);
    // Vorn ist, was auf die Kamera zukommt (z > 0) – genau unten gehört es
    // nach vorn, damit die Füsse dahinter verschwinden können.
    if ((z0 >= -0.02) !== vorn) return;
    const st = state;
    const S = view.s;
    const flamme = flammeJetzt();
    const art = lage.nr === 1 ? "blau" : flamme >= 0.3 ? "heiss" : "feuer";
    const aus = Boolean(st.fehler);
    const stark = aus ? Math.max(0.15, 1 - (st.echt - st.bild.treffer) * 1.4) : 1;
    const N = 26;
    const punkte = [];
    for (let i = 0; i <= N; i += 1) {
      const p = seilPunkt(-1 + (2 * i) / N, lage.u);
      punkte.push({ X: bx(p.x, p.z), Y: by(p.y, p.z) });
    }
    const weg = () => {
      g.beginPath();
      punkte.forEach((p, i) => { if (i === 0) g.moveTo(p.X, p.Y); else g.lineTo(p.X, p.Y); });
    };
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    // Die Schleppe: wo das Seil eben noch war.
    if (!ruhig() && Math.abs(lage.w) > 0.2 && !aus) {
      g.globalCompositeOperation = "lighter";
      for (let k = 1; k <= 8; k += 1) {
        const u = lage.u - lage.w * 0.0065 * k;
        g.globalAlpha = (vorn ? 0.085 : 0.045) * (1 - k / 9);
        g.strokeStyle = lage.nr === 1 ? "#4cc3ff" : "#ff8a2c";
        g.lineWidth = S * 0.12;
        g.beginPath();
        for (let i = 0; i <= N; i += 2) {
          const p = seilPunkt(-1 + (2 * i) / N, u);
          if (i === 0) g.moveTo(bx(p.x, p.z), by(p.y, p.z)); else g.lineTo(bx(p.x, p.z), by(p.y, p.z));
        }
        g.stroke();
      }
    }
    // Der Schein um das Seil, dann das Seil selbst.
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = (vorn ? 0.34 : 0.2) * stark;
    g.strokeStyle = lage.nr === 1 ? "#3d8bff" : "#ff7a1c";
    g.lineWidth = S * (vorn ? 0.17 : 0.12);
    weg();
    g.stroke();
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = vorn ? 1 : 0.75;
    g.strokeStyle = aus ? "#5b4a42" : lage.nr === 1 ? "#dff6ff" : "#fff0c0";
    g.lineWidth = Math.max(1.5, S * (vorn ? 0.034 : 0.024));
    weg();
    g.stroke();
    // Die Flammen: Zungen nach oben, so hoch, wie man springen muss.
    // Im Mittel etwas höher gemalt als gerechnet: Wer über die gemalten
    // kommt, ist sicher drüber.
    const bild = flammenBild(art);
    const still = ruhig();
    const M = 40;
    g.globalCompositeOperation = "lighter";
    for (let i = 1; i < M; i += 1) {
      const p = seilPunkt(-1 + (2 * i) / M, lage.u);
      const X = bx(p.x, p.z);
      const Y = by(p.y, p.z);
      const n1 = still ? 0.5 : 0.5 + 0.5 * Math.sin(st.echt * (11 + (i % 5) * 2.3) + i * 1.7 + lage.nr * 9);
      const n2 = hash01(i * 3.3 + lage.nr * 50 + (still ? 0 : Math.floor(st.echt * 12)));
      const hoch = flamme * S * (0.9 + 0.5 * n1 + 0.25 * n2) * stark;
      const breit = S * (0.15 + flamme * 0.3) * (0.85 + 0.3 * n2) * (vorn ? 1 : 0.8);
      g.globalAlpha = (vorn ? 0.8 : 0.42) * stark;
      g.drawImage(bild, X - breit / 2, Y - hoch, breit, hoch * 1.2);
    }
    g.restore();
  }

  // Zwei Glieder zwischen zwei Punkten: wo das Gelenk liegt.
  function gelenk(ax, ay, zx, zy, l1, l2, seite) {
    const dx = zx - ax;
    const dy = zy - ay;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / (Math.hypot(dx, dy) || 1);
    const uy = dy / (Math.hypot(dx, dy) || 1);
    return { x: ax + ux * a - uy * hh * seite, y: ay + uy * a + ux * hh * seite };
  }

  function glied(x0, y0, x1, y1, dick, farbe) {
    g.strokeStyle = farbe;
    g.lineWidth = dick * view.s;
    g.beginPath();
    g.moveTo(bx(x0), by(y0));
    g.lineTo(bx(x1), by(y1));
    g.stroke();
  }

  // Der Schatten unter den Füssen: kleiner und blasser, je höher der Sprung.
  function zeichneSchatten() {
    const k = clamp(1 - state.y / 1.1, 0.35, 1);
    g.fillStyle = `rgba(0, 0, 0, ${0.42 * k})`;
    g.beginPath();
    g.ellipse(bx(0), by(0) + view.s * 0.03, view.s * 0.3 * k, view.s * 0.075 * k, 0, 0, TAU);
    g.fill();
  }

  /*
   * Wer springt: ein Mädchen mit Zopf, von vorn. Die Füsse stehen genau auf
   * der gerechneten Höhe – was im Bild über den Flammen ist, ist es auch in
   * der Rechnung. In der Luft zieht sie die Knie an, die Arme schwingen hoch.
   */
  function zeichneSpringer() {
    const st = state;
    const b = st.bild;
    const y = st.y;
    const seitLandung = st.echt - b.landung;
    const stauch = st.amBoden ? clamp(1 - seitLandung / 0.14, 0, 1) * 0.5 : 0;
    const luft = st.amBoden ? 0 : clamp(y / 0.22, 0, 1);
    const getroffen = st.fehler ? clamp((st.echt - b.treffer) / 0.25, 0, 1) : 0;
    const hueft = y + 0.6 - 0.2 * luft - 0.1 * stauch;
    const schulter = hueft + 0.4 - 0.03 * stauch;
    const kopfY = schulter + 0.19;
    const wiegen = st.phase === "bereit" && !ruhig() ? Math.sin(st.echt * 2.6) * 0.012 : 0;
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    // Der Zopf, hinter dem Kopf: Er hängt dem Sprung nach.
    const zopfY = kopfY - 0.08 - clamp((y - b.zopf) * 0.9, -0.2, 0.16);
    g.strokeStyle = "#5a3520";
    g.lineWidth = view.s * 0.075;
    g.beginPath();
    g.moveTo(bx(0.1), by(kopfY + 0.05));
    g.quadraticCurveTo(bx(0.27), by(kopfY + 0.02), bx(0.25), by(zopfY - 0.16));
    g.stroke();
    // Die Beine: Hüfte, Knie nach aussen, Fuss.
    for (const seite of [-1, 1]) {
      const hx = seite * 0.075;
      const fx = seite * (0.1 + 0.05 * luft);
      const knie = gelenk(hx, hueft, fx, y + 0.05, 0.3, 0.3, seite);
      glied(hx, hueft, knie.x, knie.y, 0.095, "#2c3f7a");
      glied(knie.x, knie.y, fx, y + 0.06, 0.08, "#f0c39a");
      // Der Schuh: genau auf der gerechneten Höhe.
      g.fillStyle = getroffen ? "#3b2a26" : "#ffffff";
      g.beginPath();
      g.ellipse(bx(fx + seite * 0.02), by(y + 0.035), view.s * 0.075, view.s * 0.04, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#ff5a4a";
      g.fillRect(bx(fx + seite * 0.02) - view.s * 0.05, by(y + 0.035) - view.s * 0.008, view.s * 0.1, view.s * 0.016);
    }
    // Der Rock und das Leibchen.
    g.fillStyle = "#2c3f7a";
    g.beginPath();
    g.moveTo(bx(-0.13), by(hueft + 0.06));
    g.lineTo(bx(0.13), by(hueft + 0.06));
    g.lineTo(bx(0.17 + 0.02 * luft), by(hueft - 0.1));
    g.lineTo(bx(-0.17 - 0.02 * luft), by(hueft - 0.1));
    g.closePath();
    g.fill();
    glied(0, hueft + 0.05, 0, schulter - 0.04, 0.25, "#e8543f");
    // Die Arme: am Boden locker, im Steigen hoch, im Fallen zur Seite.
    const hoch = st.amBoden ? 0 : clamp(0.35 + st.vy / V0 * 0.75 + luft * 0.25, 0, 1);
    for (const seite of [-1, 1]) {
      const sx = seite * 0.15;
      const zx = seite * lerp(0.22, 0.4, hoch) + (getroffen ? seite * 0.08 : 0);
      const zy = lerp(schulter - 0.36, schulter + 0.22, getroffen ? 1 : hoch) + wiegen * 2;
      const ell = gelenk(sx, schulter - 0.03, zx, zy, 0.22, 0.22, zy < schulter ? seite : -seite);
      glied(sx, schulter - 0.03, ell.x, ell.y, 0.075, "#e8543f");
      glied(ell.x, ell.y, zx, zy, 0.065, "#f0c39a");
    }
    // Der Kopf: Haare, Gesicht, und was sie gerade denkt.
    g.fillStyle = "#5a3520";
    g.beginPath();
    g.arc(bx(0), by(kopfY + 0.015), view.s * 0.152, 0, TAU);
    g.fill();
    g.fillStyle = "#f6cfa6";
    g.beginPath();
    g.arc(bx(0), by(kopfY - 0.01), view.s * 0.128, 0, TAU);
    g.fill();
    g.fillStyle = "#5a3520";
    g.beginPath();
    g.ellipse(bx(0), by(kopfY + 0.09), view.s * 0.135, view.s * 0.06, 0, Math.PI, TAU);
    g.fill();
    g.fillStyle = "#2a1c14";
    const auge = view.s * (getroffen ? 0.026 : 0.017);
    for (const seite of [-1, 1]) {
      g.beginPath();
      g.arc(bx(seite * 0.05), by(kopfY - 0.005), auge, 0, TAU);
      g.fill();
    }
    g.strokeStyle = "#8a3b2c";
    g.lineWidth = Math.max(1, view.s * 0.014);
    g.beginPath();
    if (getroffen) g.arc(bx(0), by(kopfY - 0.065), view.s * 0.025, 0, TAU);
    else if (!st.amBoden) g.arc(bx(0), by(kopfY - 0.045), view.s * 0.035, 0.15 * Math.PI, 0.85 * Math.PI);
    else g.arc(bx(0), by(kopfY - 0.03), view.s * 0.04, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    // Perfekt: ein goldener Ring um die Füsse.
    const seitPerfekt = st.echt - b.perfekt;
    if (seitPerfekt < 0.35) {
      g.strokeStyle = `rgba(255, 210, 63, ${1 - seitPerfekt / 0.35})`;
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(bx(0), by(0), view.s * (0.3 + seitPerfekt * 2.2), view.s * (0.08 + seitPerfekt * 0.6), 0, 0, TAU);
      g.stroke();
    }
    g.restore();
  }

  /*
   * Die zwei Feuerkünstler: dunkle Kleider, vom Feuer gesäumt. Ihre Hand
   * kreist mit dem Seil; mit zwei Seilen kreist auch die andere.
   */
  function zeichneSchwinger(seite, lagen) {
    const S = view.s;
    const x0 = seite * (HALB + 0.5);
    const wippen = ruhig() ? 0 : Math.sin(TAU * lagen[0].u) * 0.025;
    const hueft = 0.82 + wippen;
    const schulter = hueft + 0.5;
    g.save();
    g.lineCap = "round";
    g.lineJoin = "round";
    // Die Beine: breit und fest.
    for (const b of [-1, 1]) {
      const fx = x0 + b * 0.2;
      const knie = gelenk(x0 + b * 0.07, hueft, fx, 0.04, 0.42, 0.42, -seite);
      glied(x0 + b * 0.07, hueft, knie.x, knie.y, 0.13, "#191526");
      glied(knie.x, knie.y, fx, 0.05, 0.11, "#191526");
      g.fillStyle = "#0d0b16";
      g.beginPath();
      g.ellipse(bx(fx - seite * 0.03), by(0.035), S * 0.1, S * 0.045, 0, 0, TAU);
      g.fill();
    }
    // Der Rumpf mit Schärpe.
    glied(x0, hueft, x0 - seite * 0.03, schulter, 0.3, "#221c33");
    glied(x0 - seite * 0.12, hueft + 0.06, x0 + seite * 0.12, hueft + 0.06, 0.1, seite < 0 ? "#c0392b" : "#d68910");
    // Die Arme: Die Hand am Seil kreist um die Achse.
    lagen.forEach((lage, i) => {
      const p = seilPunkt(seite, lage.u);
      const hx = p.x;
      const hy = p.y - p.z * NEIGUNG;
      const sx = x0 - seite * 0.16;
      const ell = gelenk(sx, schulter - 0.04, hx, hy, 0.3, 0.3, seite * (i ? -1 : 1));
      glied(sx, schulter - 0.04, ell.x, ell.y, 0.1, "#221c33");
      glied(ell.x, ell.y, hx, hy, 0.085, "#d9a37a");
    });
    if (lagen.length < 2) {
      // Die freie Hand in der Hüfte.
      const sx = x0 + seite * 0.14;
      const ell = gelenk(sx, schulter - 0.04, x0 + seite * 0.13, hueft + 0.05, 0.27, 0.27, seite);
      glied(sx, schulter - 0.04, ell.x, ell.y, 0.1, "#221c33");
      glied(ell.x, ell.y, x0 + seite * 0.13, hueft + 0.05, 0.085, "#d9a37a");
    }
    // Der Kopf mit Tuch.
    const kx = x0 - seite * 0.05;
    const ky = schulter + 0.2;
    g.fillStyle = "#d9a37a";
    g.beginPath();
    g.arc(bx(kx), by(ky), S * 0.13, 0, TAU);
    g.fill();
    g.fillStyle = seite < 0 ? "#c0392b" : "#d68910";
    g.beginPath();
    g.ellipse(bx(kx), by(ky + 0.045), S * 0.14, S * 0.085, 0, Math.PI, TAU);
    g.fill();
    g.fillStyle = "#1c1410";
    g.beginPath();
    g.arc(bx(kx - seite * 0.07), by(ky - 0.01), S * 0.016, 0, TAU);
    g.fill();
    // Der Saum aus Feuerschein auf der Seite zum Seil.
    g.globalCompositeOperation = "lighter";
    g.strokeStyle = `rgba(255, 140, 50, ${0.3 * flackern(seite)})`;
    g.lineWidth = Math.max(2, S * 0.03);
    g.beginPath();
    g.moveTo(bx(x0 - seite * 0.135), by(hueft + 0.04));
    g.lineTo(bx(x0 - seite * 0.165), by(schulter - 0.02));
    g.stroke();
    g.restore();
  }

  // Der Feuerschein auf dem Pflaster.
  function zeichneSchein(lagen) {
    const S = view.s;
    const flamme = flammeJetzt();
    const stark = state.fehler ? Math.max(0.2, 1 - (state.echt - state.bild.treffer)) : 1;
    g.save();
    g.globalCompositeOperation = "lighter";
    g.translate(view.cx, view.boden + S * 0.12);
    g.scale(1, 0.3);
    lagen.forEach((lage) => {
      const hoehe = ACHSE - SEIL_R * Math.cos(TAU * lage.u);
      const nah = clamp(1 - hoehe / 2.2, 0.25, 1);
      const r = S * (2.5 + flamme * 2);
      const schein = g.createRadialGradient(0, 0, S * 0.2, 0, 0, r);
      const a = (0.2 + flamme * 0.35) * nah * flackern(lage.nr) * stark;
      schein.addColorStop(0, lage.nr === 1 ? `rgba(80, 150, 255, ${a})` : `rgba(255, 150, 50, ${a})`);
      schein.addColorStop(1, "rgba(0, 0, 0, 0)");
      g.fillStyle = schein;
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fill();
    });
    g.restore();
  }

  function zeichneTeile() {
    const S = view.s;
    g.save();
    for (const t of state.teile) {
      const k = clamp(t.leben / t.max, 0, 1);
      const X = bx(t.x);
      const Y = by(t.y);
      if (t.art === "funke" || t.art === "stern" || t.art === "glut") {
        g.globalCompositeOperation = "lighter";
        g.globalAlpha = Math.min(1, k * 2);
        g.fillStyle = t.farbe;
        g.beginPath();
        g.arc(X, Y, t.r * S * (0.5 + k), 0, TAU);
        g.fill();
      } else {
        g.globalCompositeOperation = "source-over";
        g.globalAlpha = k * (t.art === "rauch" ? 0.4 : 0.3);
        g.fillStyle = t.farbe;
        g.beginPath();
        g.arc(X, Y, t.r * S * (1.6 - k * 0.6), 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  function zeichneSchriften() {
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of state.schriften) {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = clamp(t.gross * view.s / 70, t.gross * 0.8, t.gross * 1.6);
      const X = clamp(bx(t.x), 90, view.cssW - 90);
      const Y = clamp(by(t.y) - (1 - k) * 22, view.frei + 60, view.cssH - 30);
      g.globalAlpha = Math.min(1, k * 3);
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(12, 8, 20, 0.85)";
      g.strokeText(t.text, X, Y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, X, Y);
    }
    g.restore();
  }

  function pille(text, x, y, gross, grund, farbe) {
    g.font = `900 ${gross}px system-ui, sans-serif`;
    const w = g.measureText(text).width + gross * 1.4;
    const h = gross * 1.7;
    g.fillStyle = grund;
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2);
    else g.rect(x, y, w, h);
    g.fill();
    g.fillStyle = farbe;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(text, x + gross * 0.7, y + h / 2 + 1);
    return h;
  }

  // Oben links, unter den Knöpfen: die Punkte, darunter die Stufe mit ihrer
  // Figur und die Reihe der perfekten Sprünge.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    const st = state;
    g.save();
    g.translate(0, view.frei);
    const gross = Math.round(clamp(view.cssH * 0.05, 14, 24));
    const klein = Math.round(gross * 0.6);
    const x = 12;
    let y = 12;
    y += pille(`${st.punkte}`, x, y, gross, "rgba(12, 8, 20, 0.62)", "#ffffff") + 6;
    const d = rundeBei(st.seil.n);
    const figur = ANSAGE[d.figur];
    y += pille(`Stufe ${d.strophe + 1}${figur ? ` · ${figur}` : ""}`, x, y, klein, "rgba(255, 159, 28, 0.92)", "#2a1500") + 5;
    if (st.kette > 0) pille(`Perfekt ×${st.kette}`, x, y, klein, "rgba(12, 8, 20, 0.55)", "#ffd23f");
    g.restore();
  }

  // Die Ansage einer neuen Figur: gross über dem Platz, kurz.
  function zeichneAnsage() {
    const a = state.ansage;
    if (!a) return;
    const t = state.echt - a.seit;
    const k = clamp(t / 0.18, 0, 1) * clamp((1.7 - t) / 0.4, 0, 1);
    const gross = Math.round(clamp(view.s * 0.42, 20, 44));
    const Y = Math.max(view.frei + gross * 1.75, by(3.3));
    g.save();
    g.globalAlpha = k;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.lineWidth = gross * 0.2;
    g.lineJoin = "round";
    g.strokeStyle = "rgba(12, 8, 20, 0.85)";
    g.strokeText(a.text, view.cx, Y);
    g.fillStyle = "#ffb347";
    g.fillText(a.text, view.cx, Y);
    if (a.klein) {
      g.font = `800 ${Math.round(gross * 0.45)}px system-ui, sans-serif`;
      g.lineWidth = gross * 0.12;
      g.strokeText(a.klein, view.cx, Y - gross * 0.95);
      g.fillStyle = "#ffffff";
      g.fillText(a.klein, view.cx, Y - gross * 0.95);
    }
    g.restore();
  }

  function zeichnen() {
    if (!g || !view.cssW) return;
    if (!hintergrund) hintergrund = hintergrundBauen();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.drawImage(hintergrund, 0, 0);
    // Der Stoss beim Treffer.
    const seitTreffer = state.echt - state.bild.treffer;
    const stoss = !ruhig() && seitTreffer < 0.35 ? Math.sin(seitTreffer * 70) * 5 * (1 - seitTreffer / 0.35) : 0;
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, stoss * view.dpr);
    const lagen = seilLage();
    zeichneSchein(lagen);
    lagen.forEach((lage) => zeichneSeil(lage, false));
    zeichneSchwinger(-1, lagen);
    zeichneSchwinger(1, lagen);
    zeichneSchatten();
    zeichneSpringer();
    lagen.forEach((lage) => zeichneSeil(lage, true));
    zeichneTeile();
    zeichneSchriften();
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    zeichneAnsage();
    zeichneAnzeige();
  }

  const zeigen = () => !state.stumm;
  function setzeZahl() {
    if (zeigen()) shell?.setCount(state.punkte);
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  // Die Runde folgt der echten Zeit seit dem Start (losMs) in festen
  // Schritten – so passen die Züge, die mit der echten Zeit aufgezeichnet
  // werden, zur Runde. Hängt ein Bild (oder war die Seite verborgen), holt
  // sie höchstens AUFHOLEN_MAX Schritte auf; der Rest fällt weg – das Seil
  // steht dann einen Augenblick still, statt ungesehen durchzugehen.
  function aufholen() {
    if (state.phase !== "spiel") return;
    let soll = Math.floor((performance.now() - state.losMs) / (TAKT * 1000));
    if (soll - state.tick > AUFHOLEN_MAX) {
      state.losMs += (soll - state.tick - AUFHOLEN_MAX) * TAKT * 1000;
      soll = state.tick + AUFHOLEN_MAX;
    }
    while (state.tick < soll && state.phase === "spiel" && !state.fehler) simSchritt();
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    if (state.phase === "spiel") {
      aufholen();
      gegner?.takt(state.punkte);
    } else if (state.phase === "zuschauen") zuschauenTakt();
    effekte(dt);
    zeichnen();
  }

  // Für die Prüfskripte: ein Schritt ohne requestAnimationFrame. Die Runde
  // rückt genau um dt vor (losMs wandert mit, sonst holte die Schleife sie
  // danach auf die echte Zeit zurück).
  function takt(dt) {
    const h = clamp(Number(dt) || 0, 0, 0.05);
    if (state.phase === "spiel") {
      state.uhrRest += h;
      const n = Math.floor(state.uhrRest / TAKT + 1e-6);
      state.uhrRest = Math.max(0, state.uhrRest - n * TAKT);
      state.losMs -= n * TAKT * 1000;
      for (let i = 0; i < n && state.phase === "spiel" && !state.fehler; i += 1) simSchritt();
      if (state.phase === "spiel") gegner?.takt(state.punkte);
    } else if (state.phase === "zuschauen") zuschauenTakt();
    effekte(h);
  }

  // ---------------------------------------------------------------------------
  // Tippen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los). Das Seil schwingt hinten
  // hinauf und kommt nach gut einer Sekunde zum ersten Mal vorn herunter.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    state.tick = 0;
    state.uhrRest = 0;
    state.losMs = performance.now();
    shell.setPhase("play");
    gegner?.los();
    aufnahme?.los();
    meldeZug(ZUG_START);
    kids()?.vibrate?.(8);
  }

  // Drücken (runter) oder Loslassen – vom Finger, von der Taste oder aus den
  // Prüfskripten. Der erste Tipp startet nur: Gesprungen wird ab dem zweiten.
  function taste(runter) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      if (runter && !shell.live) losGehts();
      return;
    }
    if (state.phase !== "spiel") return;
    eingabe(runter);
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
    state.losMs = 0;
    state.plan = { runden: [], figuren: [] };
    planBis(14 * STROPHE);
    simZuruecksetzen();
    zugProtokoll = [];
    state.zugNr = 0;
    state.zugVerlauf = [];
    state.fertig = false;
    state.stumm = false;
    state.bild = neuesBild();
    state.teile = [];
    state.schriften = [];
    state.ansage = null;
    finger.clear();
    tasten.clear();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt fe-prompt", "Tippen heisst hüpfen, halten springt höher – bleib über dem Feuerseil.");
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
    const dauer = Math.min(800, 160 + ziel * 6);
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

  const GRUND = {
    spaet: "Zu spät abgesprungen",
    frueh: "Zu früh abgesprungen",
    flach: "Zu flach – länger halten",
  };

  function finish() {
    if (state.phase === "zuschauen") return;
    clearStep();
    if (state.fertig) return;
    state.fertig = true;
    state.phase = "ende";
    stopLoop();
    klangAus();
    if (g) zeichnen();
    const punkte = state.punkte;
    const geist = aufnahme?.ende(gegner?.ende(punkte) || null) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), punkte].sort((x, y) => y - x).slice(0, TOP_COUNT),
    }));
    const seile = state.seile === 1 ? "1 Seil übersprungen" : `${state.seile} Seile übersprungen`;
    const teile = [
      seile,
      state.perfekte ? `${state.perfekte} perfekt` : "",
      GRUND[state.fehler?.grund] || "",
      vorher ? `Bestwert ${vorher}` : "",
    ];
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! ${seile}` : teile.filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("fe-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Getippt wird auf der ganzen Bühne. Gedrückt ist, solange irgendein Finger
  // liegt oder eine der Tasten unten ist.
  const finger = new Set();
  const tasten = new Set();
  const unten = () => finger.size + tasten.size;

  shell = shellApi.mount({
    host,
    title: "Feuerseil",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "fireRope", fassung: "z1", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "fireRope", host, art: "ziel" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;
  }

  // Vor dem Druck holt die Runde bis jetzt auf: Er gilt in dem Schritt, in
  // dem der Finger kam, nicht im letzten Bild.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const vorher = unten();
    finger.add(event.pointerId);
    if (vorher > 0) return;
    aufholen();
    taste(true);
  });
  const fingerWeg = (event) => {
    if (!finger.delete(event.pointerId)) return;
    if (unten() > 0) return;
    aufholen();
    taste(false);
  };
  window.addEventListener("pointerup", fingerWeg);
  window.addEventListener("pointercancel", fingerWeg);

  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter" && event.key !== "ArrowUp") return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    const vorher = unten();
    tasten.add(event.code || event.key);
    if (vorher > 0) return;
    aufholen();
    taste(true);
  });
  document.addEventListener("keyup", (event) => {
    if (!tasten.delete(event.code || event.key)) return;
    if (unten() > 0) return;
    aufholen();
    taste(false);
  });
  // Wer das Fenster verlässt, lässt los.
  window.addEventListener("blur", () => {
    const war = unten() > 0;
    finger.clear();
    tasten.clear();
    if (war) taste(false);
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Für die Prüfskripte und die Vorführung: der Zustand, ein Schritt ohne
  // Bild (takt), Drücken und Loslassen, was als Nächstes durchgeht
  // (vorschau), was ein Sprung kann (sprungProfil) und die Welt (weltText).
  window.LernappFeuerseil = {
    HZ, TAKT, G, V0, HALT_MIN, PUFFER, STROPHE, PERFEKT, KETTE_MAX, ENDE_AB, FLAMME0, FLAMME_MAX,
    state, view, takt, zeichnen, losGehts,
    druecke: () => taste(true),
    loslassen: () => taste(false),
    vorschau, sprungProfil, periodeBei, flammeBei, rundeBei, weltText, planBis,
    zugProtokoll: () => zugProtokoll.slice(),
    // Zuschauen mit einer eigenen Quelle – wie live.zuschauen im Multiplayer.
    zuschauenMit(quelle) { zuschauer = quelle; zuschauenStarten(); },
  };
})();
