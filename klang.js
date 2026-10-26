/*
 * klang.js – die Klänge der arcade.
 * ---------------------------------------------------------------------------
 * Ausgewählt im Oktober 2026 auf einer Klangauswahl mit 442 Vorschlägen für
 * 109 Plätze: einheitliche Klänge für alle Spiele (Punkt, Perfekt,
 * Meilenstein, Fehler, Tafel, Rekord, Überholt, Countdown, Knopf, Fenster)
 * und je Spiel eigene. Ein Teil sind kurze Aufnahmen aus freien Sammlungen
 * (Kenney, OpenGameArt – alle CC0) unter klang/, der Rest entsteht hier im
 * Browser: Glocken, 8-Bit-Töne, Wind, Motoren, Schnee.
 *
 * Weniger ist mehr: Wieder weg sind die «Serie» (jedes Perfekt in Folge
 * einen Ton höher) und der Ton zum Rundenstart. Ein Klang kommt nur noch zu
 * einem perfekten Zug oder wenn etwas geschafft ist (Scheibe, Teich, Schiff,
 * Raum) – nie nur, weil eine Zahl erreicht ist (alle 10, alle 100 m).
 *
 * Ein Spiel ruft:
 *
 *   ArcadeKlang.ton("punkt")                 einheitlich für alle Spiele
 *   ArcadeKlang.ton("ball.kick")             der eigene Klang eines Spiels
 *   const wind = ArcadeKlang.kulisse("huegel.wind");   // oder ({ laut: 0 })
 *   wind.setze(0…1);  wind.laut(0…1);  wind.stop();
 *
 * ton() nimmt ausserdem { laut } (0…1.5, Vorgabe 1), { hoehe } (Faktor auf
 * die Tonhöhe einer Aufnahme), { verzoegerung } (Sekunden bis zum Klang) und
 * beim Countdown { stufe } (3, 2, 1, 0 = «Los!»). Aufnahmen streuen von selbst ein wenig in der
 * Tonhöhe, damit derselbe Schritt nicht wie ein Maschinengewehr klingt.
 *
 * Eine Kulisse ist eine Schleife: Wind, Motor, Publikum. setze() verstellt,
 * was sie ausmacht (Tempo, Drehzahl, Stärke – je nach Kulisse), laut() nur
 * die Lautstärke. Dieselbe Kulisse läuft nie zweimal: kulisse() gibt die
 * laufende zurück; laeuft(id) fragt, ohne zu starten. stille() hält alle an;
 * die Bühne (game-shell.js) ruft es, sobald die Tafel kommt.
 *
 * Lautstärke: Alles ist auf dieselbe Lautheit gebracht (Einmal-Klänge
 * -20 dB RMS, Kulissen -27 dB, gemessen) und läuft über einen leisen
 * Hauptregler und einen Begrenzer. Die Klänge sollen die Spiele begleiten,
 * nicht übertönen. Der Ton-Schalter oben rechts (kids.js) gilt auch hier.
 */
(() => {
  "use strict";

  const HAUPT = 0.5;       // alles zusammen
  const KULISSE = 0.7;     // Kulissen unter den Einmal-Klängen
  const AUDIO_KEY = "lernapp.audioFeedback";

  const kids = () => window.LernappKids || null;

  // ---------------------------------------------------------------------------
  // Die Plätze: was bei welchem Ereignis klingt
  // ---------------------------------------------------------------------------
  // s: im Browser erzeugt (SYNTH/SCHLEIFE unten), d: Datei unter klang/.
  // tempo: setze() einer Aufnahme verstellt die Abspielgeschwindigkeit
  // (Motoren); sonst nur ihre Lautstärke.
  const PLAETZE = {
    punkt: { s: "pop" },
    perfekt: { s: "harfe" },
    meilenstein: { s: "harfe-lang" },
    fehler: { s: "ab-sanft" },
    tafel: { s: "fanfare-klein" },
    rekord: { s: "fanfare" },
    ueberholt: { s: "ueberholt" },
    countdown: { s: "countdown" },
    knopf: { s: "klick" },
    fenster: { s: "woosh-kurz" },

    "turmbau.landen": { d: "turmbau-landen" },
    "turmbau.ab": { d: "turmbau-ab" },
    "turmbau.einsturz": { d: "turmbau-einsturz" },
    "bruecke.wachsen": { s: "ratsche", schleife: true },
    "bruecke.kippen": { s: "holzblock" },
    "bruecke.absturz": { s: "ab" },
    "drehscheibe.wurf": { s: "woosh-kurz" },
    "drehscheibe.einschlag": { s: "holzblock" },
    "drehscheibe.klirr": { d: "drehscheibe-klirr" },
    "drehscheibe.apfel": { s: "pop" },
    "liane.schwung": { d: "liane-schwung" },
    "liane.greifen": { d: "liane-greifen" },
    "liane.platsch": { d: "platsch" },
    "liane.ambient": { d: "voegel", schleife: true },
    "tunnelflug.antrieb": { d: "tunnelflug-antrieb", schleife: true, tempo: true },
    "tunnelflug.crash": { d: "tunnelflug-crash" },
    "drift.motor": { d: "drift-motor", schleife: true, tempo: true },
    "drift.drift": { s: "a-kies", schleife: true },
    "drift.crash": { d: "drift-crash" },
    "planeten.sprung": { d: "planeten-sprung" },
    "planeten.landung": { s: "whomp-weich" },
    "planeten.ambient": { s: "a-weltraum", schleife: true },
    "mondlandung.schub": { d: "mondlandung-schub", schleife: true, tempo: true },
    "mondlandung.landung": { s: "whomp-weich" },
    "mondlandung.tanken": { s: "tanken" },
    "mondlandung.explosion": { d: "mondlandung-explosion" },
    "schwerkraft.wechsel": { d: "schwerkraft-wechsel" },
    "schwerkraft.schritte": { s: "a-schritte", schleife: true },
    "schwerkraft.crash": { s: "ab" },
    "huegel.wind": { s: "a-wind", schleife: true },
    "huegel.landung": { s: "whomp-weich" },
    "huegel.abheben": { d: "huegel-abheben" },
    "ballon.brenner": { d: "ballon-brenner", schleife: true, tempo: true },
    "ballon.wind": { s: "a-wind", schleife: true },
    "ballon.gewitter": { d: "ballon-gewitter" },
    "slalom.carven": { s: "a-schnee", schleife: true },
    "slalom.tor": { s: "klack" },
    "slalom.sturz": { s: "schnee-sturz" },
    "frosch.laden": { s: "aufladen", schleife: true },
    "frosch.sprung": { d: "frosch-sprung" },
    "frosch.landung": { d: "frosch-landung" },
    "frosch.wasser": { d: "platsch" },
    "frosch.ambient": { s: "a-grillen", schleife: true },
    "kranhafen.los": { d: "kranhafen-los" },
    "kranhafen.aufsetzen": { d: "kranhafen-aufsetzen" },
    "kranhafen.wasser": { d: "platsch" },
    "kranhafen.ambient": { d: "kranhafen-ambient", schleife: true },
    "seiltaenzer.boee": { s: "boee" },
    "seiltaenzer.schritt": { d: "seiltaenzer-schritt" },
    "seiltaenzer.absturz": { s: "fall" },
    "draht.summen": { s: "a-summen", schleife: true },
    "draht.beruehrung": { d: "draht-beruehrung" },
    "spuren.kufen": { s: "a-eis", schleife: true },
    "spuren.wechsel": { d: "spuren-wechsel" },
    "spuren.crash": { d: "spuren-crash" },
    "ball.kick": { s: "kick" },
    "ball.netz": { d: "ball-netz" },
    "ball.taube": { s: "flatter" },
    "ball.rasen": { s: "whomp" },
    "ball.publikum": { d: "publikum", schleife: true },
    "blaetter.wisch": { d: "blaetter-wisch" },
    "blaetter.fluss": { d: "blaetter-fluss", schleife: true },
    "kacheln.leuchten": { s: "marimba" },
    "kacheln.tippen": { d: "kacheln-tippen" },
    "fischteich.fisch": { s: "blubb" },
    "fischteich.teich": { d: "fischteich-teich", schleife: true },
    "zahlengleis.fahrt": { s: "a-zug", schleife: true },
    "zahlengleis.pfeife": { d: "zahlengleis-pfeife" },
    "zahlengleis.halt": { d: "zahlengleis-halt" },
    "heizer.schaufel": { s: "kohle" },
    "heizer.dampf": { s: "zisch" },
    "heizer.platzt": { d: "heizer-platzt" },
    "heizer.kessel": { s: "a-kessel", schleife: true },
    "jongleur.wurf": { d: "jongleur-wurf" },
    "jongleur.fang": { d: "jongleur-fang" },
    "jongleur.trommel": { s: "trommelwirbel" },
    "jongleur.zirkus": { d: "publikum", schleife: true },
    "skispringen.anlauf": { s: "a-spur", schleife: true },
    "skispringen.absprung": { s: "absprung" },
    "skispringen.flug": { s: "a-fahrtwind", schleife: true },
    "skispringen.landung": { s: "schnee-landung" },
    "skispringen.publikum": { d: "skispringen-publikum" },
    "fallschirm.freifall": { d: "fallschirm-freifall", schleife: true },
    "fallschirm.schirm": { s: "schirm" },
    "fallschirm.landung": { s: "whomp-weich" },
    "fallschirm.flugzeug": { s: "a-propeller", schleife: true },
    "holzfaeller.schnitt": { d: "holzfaeller-schnitt" },
    "holzfaeller.nagel": { d: "holzfaeller-nagel" },
    "holzfaeller.wald": { d: "voegel", schleife: true },
    "fledermaus.fluegel": { d: "fledermaus-fluegel" },
    "fledermaus.echo": { s: "sonar" },
    "fledermaus.hoehle": { d: "fledermaus-hoehle", schleife: true },
    "fledermaus.aufprall": { s: "whomp" },
    "ninja.zeit": { s: "a-herz", schleife: true },
    "ninja.pfeil": { d: "ninja-pfeil" },
    "ninja.treffer": { d: "ninja-treffer" },
    "ninja.rolle": { s: "pling" },
  };

  // Welche Seite welche Plätze braucht: die Dateien eines Spiels werden
  // vorgeladen, sobald seine Seite Ruhe hat (body data-spiel).
  const BEREICH = {
    towerStack: "turmbau", bridgeBuilder: "bruecke", dartWheel: "drehscheibe", vineSwing: "liane",
    tunnelFlight: "tunnelflug", driftRace: "drift", planetHop: "planeten", moonLander: "mondlandung",
    gravityRun: "schwerkraft", hillGlide: "huegel", balloonRide: "ballon", skiSlalom: "slalom",
    frogHop: "frosch", craneHarbor: "kranhafen", ropeWalk: "seiltaenzer", wireLoop: "draht",
    twinLanes: "spuren", keepyUppy: "ball", leafFlow: "blaetter", tileMemory: "kacheln",
    fishPond: "fischteich", numberLine: "zahlengleis", boilerRoom: "heizer", juggler: "jongleur",
    skiJump: "skispringen", skyDive: "fallschirm", lumberCut: "holzfaeller", batEcho: "fledermaus",
    timeNinja: "ninja",
  };

  // ---------------------------------------------------------------------------
  // Die Tonausgabe
  // ---------------------------------------------------------------------------
  // Dieselbe wie die von kids.js, wo es sie gibt: ein AudioContext für die
  // ganze Seite, und der Ton-Schalter schaltet beide. Auf der Startseite
  // (ohne kids.js) eine eigene, mit demselben Schalter im Speicher.
  let eigenerKontext = null;
  let ctx = null;
  let haupt = null;
  let effekte = null;
  let kulissen = null;
  let rauschPuffer = null;

  function tonErlaubt() {
    const k = kids();
    if (k?.audioEnabled) return k.audioEnabled();
    let wert = null;
    try { wert = localStorage.getItem(AUDIO_KEY); } catch { /* privat */ }
    return wert !== "0" && wert !== "false" && wert !== "off";
  }

  function kontext() {
    if (!tonErlaubt()) return null;
    let c = kids()?.audioKontext?.() || null;
    if (!c) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { eigenerKontext = eigenerKontext || new AC(); } catch { return null; }
      c = eigenerKontext;
      if (c.state === "suspended") c.resume().catch(() => {});
    }
    if (c !== ctx) {
      ctx = c;
      // Hauptregler → Begrenzer → Lautsprecher. Der Begrenzer fängt ab, wenn
      // viel auf einmal klingt (vier Stämme in einem Wisch).
      haupt = ctx.createGain();
      haupt.gain.value = HAUPT;
      const begrenzer = ctx.createDynamicsCompressor();
      begrenzer.threshold.value = -10;
      begrenzer.knee.value = 6;
      begrenzer.ratio.value = 8;
      begrenzer.attack.value = 0.003;
      begrenzer.release.value = 0.2;
      haupt.connect(begrenzer).connect(ctx.destination);
      effekte = ctx.createGain();
      effekte.connect(haupt);
      kulissen = ctx.createGain();
      kulissen.gain.value = KULISSE;
      kulissen.connect(haupt);
      rauschPuffer = null;
    }
    return ctx;
  }

  // Im Hintergrund schweigt die Seite: Kulissen laufen nicht weiter, wenn
  // jemand die App wechselt.
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.().catch(() => {});
    else if (tonErlaubt()) ctx.resume?.().catch(() => {});
  });
  // Der eigene Kontext (Startseite) wird beim ersten Tipp geweckt.
  ["pointerdown", "touchstart", "keydown"].forEach((typ) => {
    document.addEventListener(typ, () => { if (eigenerKontext?.state === "suspended" && tonErlaubt()) eigenerKontext.resume().catch(() => {}); },
      { capture: true, passive: true });
  });

  // ---------------------------------------------------------------------------
  // Bausteine der erzeugten Klänge
  // ---------------------------------------------------------------------------
  let bus = null; // wohin ein Klang gerade spielt (siehe spieleSynth)
  const note = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function rauschen() {
    if (!rauschPuffer) {
      const n = ctx.sampleRate * 3;
      rauschPuffer = ctx.createBuffer(1, n, ctx.sampleRate);
      const d = rauschPuffer.getChannelData(0);
      for (let i = 0; i < n; i += 1) d[i] = Math.random() * 2 - 1;
    }
    return rauschPuffer;
  }

  function huelle(g, t, a, h, r, spitze) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(spitze, t + a);
    if (h > 0) g.gain.setValueAtTime(spitze, t + a + h);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + r);
  }

  function filter(typ, f, q = 1) {
    const fl = ctx.createBiquadFilter();
    fl.type = typ;
    fl.frequency.value = f;
    fl.Q.value = q;
    return fl;
  }

  // Ein Ton: Oszillator mit Hülle, wahlweise gleitend, gefiltert, mit Vibrato.
  function ton(f, t, { typ = "sine", a = 0.004, h = 0, r = 0.2, laut = 0.25, f2 = null, gleit = 0.1, tief = null, vib = 0, ziel = bus } = {}) {
    const o = ctx.createOscillator();
    o.type = typ;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + gleit);
    if (vib) {
      const l = ctx.createOscillator();
      const lg = ctx.createGain();
      l.frequency.value = vib;
      lg.gain.value = f * 0.02;
      l.connect(lg).connect(o.frequency);
      l.start(t);
      l.stop(t + a + h + r + 0.05);
    }
    const g = ctx.createGain();
    huelle(g, t, a, h, r, laut);
    let k = o;
    if (tief) { const fl = filter("lowpass", tief, 0.7); o.connect(fl); k = fl; }
    k.connect(g).connect(ziel);
    o.start(t);
    o.stop(t + a + h + r + 0.05);
  }

  // Rauschen durch einen Filter, dessen Frequenz gleiten kann.
  function rausch(t, { dauer = 0.3, typ = "bandpass", f = 1000, f2 = null, q = 1, a = 0.01, r = 0.2, laut = 0.25, ziel = bus } = {}) {
    const s = ctx.createBufferSource();
    s.buffer = rauschen();
    s.loop = true;
    const fl = filter(typ, f, q);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dauer);
    const g = ctx.createGain();
    huelle(g, t, a, Math.max(0, dauer - a - r), r, laut);
    s.connect(fl).connect(g).connect(ziel);
    s.start(t, Math.random() * 2);
    s.stop(t + dauer + 0.1);
  }

  // Echo: ein Verzögerungsglied mit Rückkopplung (der Ruf der Fledermaus).
  function echo(zeit = 0.18, rueck = 0.45) {
    const d = ctx.createDelay(1);
    d.delayTime.value = zeit;
    const fb = ctx.createGain();
    fb.gain.value = rueck;
    const lp = filter("lowpass", 3000, 0.5);
    const ein = ctx.createGain();
    ein.connect(bus);
    ein.connect(d);
    d.connect(lp).connect(fb).connect(d);
    lp.connect(bus);
    return ein;
  }

  const holzblock = (t) => {
    ton(220, t, { f2: 110, gleit: 0.1, r: 0.14, laut: 0.4 });
    rausch(t, { dauer: 0.05, f: 800, q: 3, r: 0.04, laut: 0.25 });
  };
  const whompWeich = (t) => {
    ton(110, t, { f2: 60, gleit: 0.15, r: 0.2, laut: 0.4 });
    rausch(t, { dauer: 0.1, typ: "lowpass", f: 300, r: 0.08, laut: 0.15 });
  };
  // Die Einmal-Klänge. t ist der Zeitpunkt im AudioContext, o die Wahl aus
  // ton() (stufe).
  const SYNTH = {
    pop: (t) => { ton(280, t, { f2: 900, gleit: 0.05, r: 0.09, laut: 0.35 }); rausch(t, { dauer: 0.015, f: 3000, r: 0.01, laut: 0.05 }); },
    harfe: (t) => [72, 76, 79, 84].forEach((n, i) => ton(note(n + 12), t + i * 0.06, { typ: "triangle", r: 0.45, laut: 0.14 })),
    "harfe-lang": (t) => [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => ton(note(n), t + i * 0.055, { typ: "triangle", r: 0.6, laut: 0.13 })),
    "ab-sanft": (t) => { ton(note(67), t, { typ: "triangle", r: 0.22, laut: 0.2 }); ton(note(60), t + 0.18, { typ: "triangle", r: 0.45, laut: 0.2 }); },
    "fanfare-klein": (t) => {
      [72, 76, 79].forEach((n, i) => ton(note(n), t + i * 0.1, { typ: "triangle", r: 0.15, laut: 0.16 }));
      [84, 88, 91].forEach((n) => ton(note(n), t + 0.32, { typ: "triangle", h: 0.15, r: 0.5, laut: 0.1 }));
    },
    fanfare: (t) => {
      const b = (n, s, d, l = 0.09) => ton(note(n), t + s, { typ: "sawtooth", a: 0.02, h: d, r: 0.12, laut: l, tief: 2200 });
      b(67, 0, 0.08); b(72, 0.12, 0.08); b(76, 0.24, 0.08); b(79, 0.36, 0.22);
      [72, 76, 79, 84].forEach((n) => b(n, 0.66, 0.45, 0.06));
    },
    ueberholt: (t) => {
      rausch(t, { dauer: 0.3, f: 400, f2: 3500, q: 1.2, a: 0.2, r: 0.08, laut: 0.12 });
      ton(note(91), t + 0.25, { typ: "triangle", r: 0.18, laut: 0.14 });
      ton(note(96), t + 0.33, { typ: "triangle", r: 0.4, laut: 0.14 });
    },
    // Im Spiel ein Ton je Sekunde: 3, 2, 1 tief, 0 («Los!») hoch.
    countdown: (t, o) => {
      if (Number(o?.stufe) > 0) ton(note(81), t, { r: 0.15, laut: 0.2 });
      else ton(note(93), t, { h: 0.2, r: 0.4, laut: 0.2 });
    },
    klick: (t) => { rausch(t, { dauer: 0.012, typ: "highpass", f: 3000, r: 0.008, laut: 0.12 }); ton(2000, t, { r: 0.02, laut: 0.05 }); },
    "woosh-kurz": (t) => rausch(t, { dauer: 0.2, f: 600, f2: 2600, q: 1.4, a: 0.08, r: 0.1, laut: 0.22 }),
    holzblock,
    ab: (t) => ton(420, t, { typ: "sawtooth", f2: 100, gleit: 0.55, a: 0.01, h: 0.3, r: 0.3, laut: 0.12, tief: 1200 }),
    "whomp-weich": whompWeich,
    whomp: (t) => { ton(150, t, { f2: 42, gleit: 0.25, r: 0.3, laut: 0.55 }); rausch(t, { dauer: 0.12, typ: "lowpass", f: 500, r: 0.1, laut: 0.25 }); },
    tanken: (t) => ton(300, t, { typ: "triangle", f2: 950, gleit: 0.8, a: 0.05, h: 0.7, r: 0.15, laut: 0.12, vib: 12 }),
    klack: (t) => {
      ton(1800, t, { r: 0.03, laut: 0.12 });
      ton(900, t, { r: 0.05, laut: 0.12 });
      rausch(t, { dauer: 0.02, typ: "highpass", f: 2000, r: 0.015, laut: 0.12 });
    },
    "schnee-sturz": (t) => { rausch(t, { dauer: 0.55, typ: "lowpass", f: 1400, f2: 300, a: 0.01, r: 0.45, laut: 0.35 }); whompWeich(t); },
    boee: (t) => rausch(t, { dauer: 1.7, f: 450, f2: 900, q: 0.8, a: 0.7, r: 0.9, laut: 0.25 }),
    fall: (t) => ton(1400, t, { f2: 260, gleit: 0.9, a: 0.02, h: 0.7, r: 0.2, laut: 0.09, vib: 7 }),
    kick: (t) => { ton(170, t, { f2: 55, gleit: 0.1, r: 0.13, laut: 0.55 }); rausch(t, { dauer: 0.025, f: 2200, q: 2, r: 0.02, laut: 0.2 }); },
    flatter: (t) => { for (let i = 0; i < 9; i += 1) rausch(t + i * 0.045, { dauer: 0.035, f: 1200, q: 1.5, r: 0.03, laut: 0.22 * (1 - i / 10) }); },
    marimba: (t) => { ton(note(84), t, { r: 0.45, laut: 0.22 }); ton(note(84) * 4, t, { r: 0.06, laut: 0.066 }); },
    blubb: (t) => { ton(300, t, { f2: 950, gleit: 0.05, r: 0.06, laut: 0.25 }); ton(420, t + 0.07, { f2: 1200, gleit: 0.04, r: 0.05, laut: 0.18 }); },
    kohle: (t) => {
      rausch(t, { dauer: 0.12, f: 600, q: 1, r: 0.1, laut: 0.25 });
      for (let i = 0; i < 6; i += 1) rausch(t + 0.03 + Math.random() * 0.2, { dauer: 0.02, f: 2500 + Math.random() * 2000, q: 4, r: 0.015, laut: 0.12 });
    },
    zisch: (t) => rausch(t, { dauer: 0.7, typ: "highpass", f: 3200, a: 0.03, r: 0.5, laut: 0.18 }),
    absprung: (t) => { SYNTH["woosh-kurz"](t); ton(300, t, { typ: "triangle", f2: 650, gleit: 0.15, r: 0.1, laut: 0.12 }); },
    "schnee-landung": (t) => { rausch(t, { dauer: 0.4, typ: "lowpass", f: 2600, f2: 600, r: 0.3, laut: 0.3 }); whompWeich(t); },
    trommelwirbel: (t) => {
      for (let i = 0; i < 40; i += 1) rausch(t + i * 0.04, { dauer: 0.03, f: 2200, q: 0.8, r: 0.025, laut: 0.04 + 0.12 * (i / 40) });
      rausch(t + 1.62, { dauer: 1.0, typ: "highpass", f: 5000, a: 0.005, r: 0.9, laut: 0.12 });
      ton(80, t + 1.62, { f2: 50, gleit: 0.2, r: 0.3, laut: 0.4 });
    },
    schirm: (t) => {
      rausch(t, { dauer: 0.18, typ: "lowpass", f: 600, f2: 1600, a: 0.12, r: 0.05, laut: 0.25 });
      [0.2, 0.28, 0.35].forEach((s, i) => rausch(t + s, { dauer: 0.06, f: 700, q: 1, r: 0.05, laut: 0.3 - i * 0.08 }));
      ton(90, t + 0.2, { f2: 55, gleit: 0.15, r: 0.2, laut: 0.35 });
    },
    sonar: (t) => ton(2200, t, { r: 0.22, laut: 0.12, ziel: echo(0.16, 0.45) }),
    pling: (t) => { ton(note(91), t, { r: 0.4, laut: 0.16 }); ton(note(98), t, { r: 0.18, laut: 0.05 }); },
  };

  // Korrektur in dB je Klang, gemessen: Einmal-Klänge auf -20 dB aktives RMS,
  // Schleifen bei k = 0.5 auf -27 dB (wie die Aufnahmen in klang/).
  const PEGEL = {
    pop: 0.4, harfe: 6.1, "harfe-lang": 5.2, "ab-sanft": 6.1, "fanfare-klein": 3.7, fanfare: 6.6,
    ueberholt: 11.0, countdown: 0.3, klick: 10.2, "woosh-kurz": 14.0, holzblock: -0.5, ab: 5.7, "whomp-weich": -0.6,
    whomp: -3.9, tanken: 3.7, klack: 7.6, "schnee-sturz": 1.0, boee: 13.7, fall: 4.3, kick: -2.8, flatter: 20.8,
    marimba: 3.4, blubb: 5.9, kohle: 17.4, zisch: 2.1, absprung: 11.9, "schnee-landung": 0.2, trommelwirbel: 0.4,
    schirm: 2.3, sonar: 10.1, pling: 6.3,
  };
  const PEGEL_SCHLEIFE = {
    "a-eis": 0.5, "a-fahrtwind": -1.2, "a-grillen": 18.1, "a-herz": -7.1, "a-kessel": 5.7, "a-kies": 5.3,
    "a-propeller": 3.9, "a-schnee": 3.6, "a-schritte": 10.2, "a-spur": 6.6, "a-summen": 9.9, "a-weltraum": 0.6,
    "a-wind": 1.8, "a-zug": 2.0, aufladen: -0.6, ratsche: 13.5,
  };
  const db = (x) => Math.pow(10, (x || 0) / 20);

  // ---------------------------------------------------------------------------
  // Erzeugte Schleifen
  // ---------------------------------------------------------------------------
  function rauschQuelle() {
    const s = ctx.createBufferSource();
    s.buffer = rauschen();
    s.loop = true;
    s.start(ctx.currentTime, Math.random() * 2);
    return s;
  }
  function osz(typ, f) { const o = ctx.createOscillator(); o.type = typ; o.frequency.value = f; o.start(); return o; }
  function verst(v) { const g = ctx.createGain(); g.gain.value = v; return g; }
  const glatt = (param, wert, zeit = 0.15) => param.setTargetAtTime(wert, ctx.currentTime, zeit);

  // aus: der Ausgang der Schleife, merke(): Knoten, die beim Stoppen enden,
  // takt(): ein Zeitgeber für Ereignisse (Schritte, Grillen). Die Zeitgeber
  // laufen nur, solange die Seite sichtbar ist – im Hintergrund schweigt der
  // Kontext ohnehin.
  function schleifeBauen(bau) {
    const knoten = [];
    const aus = ctx.createGain();
    aus.connect(bus);
    let zeitgeber = null;
    const api = bau({
      aus,
      merke: (...k) => { knoten.push(...k); return k[0]; },
      takt: (fn, ms) => { zeitgeber = window.setInterval(() => { if (!document.hidden) fn(); }, ms); },
    });
    return {
      setze: (k) => api.setze?.(k),
      aufraeumen() {
        if (zeitgeber) window.clearInterval(zeitgeber);
        knoten.forEach((n) => { try { n.stop?.(); n.disconnect(); } catch { /* schon weg */ } });
        aus.disconnect();
      },
    };
  }

  const SCHLEIFE = {
    "a-wind": () => schleifeBauen(({ aus, merke, takt }) => {
      const s = merke(rauschQuelle());
      const fl = filter("bandpass", 600, 0.6);
      const g = verst(0.1);
      s.connect(fl).connect(g).connect(aus);
      let k = 0.5;
      takt(() => { const boe = 0.7 + Math.random() * 0.6; glatt(g.gain, (0.05 + 0.3 * k) * boe, 0.6); glatt(fl.frequency, (350 + 900 * k) * boe, 0.8); }, 700);
      return { setze: (w) => { k = w; glatt(g.gain, 0.05 + 0.3 * k); glatt(fl.frequency, 350 + 900 * k); } };
    }),
    "a-fahrtwind": () => schleifeBauen(({ aus, merke }) => {
      const s = merke(rauschQuelle());
      const hp = filter("highpass", 200, 0.5);
      const lp = filter("lowpass", 2000, 0.5);
      const g = verst(0.15);
      s.connect(hp).connect(lp).connect(g).connect(aus);
      return { setze: (k) => { glatt(lp.frequency, 700 + 4500 * k); glatt(g.gain, 0.03 + 0.32 * k); } };
    }),
    "a-schritte": () => schleifeBauen(({ aus, takt }) => {
      let k = 0.5;
      let n = 0;
      let warte = 0;
      takt(() => {
        warte -= 25;
        if (warte > 0) return;
        warte = 1000 / (2.5 + 5 * k);
        rausch(ctx.currentTime + 0.01, { dauer: 0.05, typ: "lowpass", f: n % 2 ? 900 : 700, r: 0.04, laut: 0.25, ziel: aus });
        n += 1;
      }, 25);
      return { setze: (w) => { k = w; } };
    }),
    "a-kies": () => schleifeBauen(({ aus, merke, takt }) => {
      const s = merke(rauschQuelle());
      const bp = filter("bandpass", 1500, 0.9);
      const g = verst(0.1);
      s.connect(bp).connect(g).connect(aus);
      let k = 0.5;
      takt(() => glatt(g.gain, (0.04 + 0.2 * k) * (0.4 + Math.random()), 0.01), 35);
      return { setze: (w) => { k = w; } };
    }),
    "a-schnee": () => schleifeBauen(({ aus, merke }) => {
      const s = merke(rauschQuelle());
      const bp = filter("bandpass", 2000, 1.1);
      const g = verst(0.1);
      s.connect(bp).connect(g).connect(aus);
      const lfo = merke(osz("sine", 0.8));
      const lg = verst(0.05);
      lfo.connect(lg).connect(g.gain);
      return { setze: (k) => { glatt(bp.frequency, 1100 + 2000 * k); glatt(g.gain, 0.05 + 0.2 * k); glatt(lg.gain, 0.02 + 0.08 * k); } };
    }),
    "a-spur": () => schleifeBauen(({ aus, merke }) => {
      const s = merke(rauschQuelle());
      const bp = filter("bandpass", 1200, 2);
      const g = verst(0.1);
      s.connect(bp).connect(g).connect(aus);
      const hp = filter("highpass", 5000, 0.7);
      const hg = verst(0.02);
      s.connect(hp).connect(hg).connect(aus);
      return { setze: (k) => { glatt(bp.frequency, 800 + 1600 * k); glatt(g.gain, 0.04 + 0.2 * k); glatt(hg.gain, 0.005 + 0.04 * k); } };
    }),
    "a-summen": () => schleifeBauen(({ aus, merke }) => {
      const o1 = merke(osz("sawtooth", 100));
      const o2 = merke(osz("sawtooth", 150.5));
      const bp = filter("bandpass", 450, 2);
      const g = verst(0.05);
      o1.connect(bp); o2.connect(bp);
      bp.connect(g).connect(aus);
      const trem = merke(osz("sine", 6));
      const tg = verst(0.02);
      trem.connect(tg).connect(g.gain);
      return { setze: (k) => { glatt(g.gain, 0.015 + 0.12 * k); glatt(bp.frequency, 350 + 900 * k); } };
    }),
    "a-eis": () => schleifeBauen(({ aus, merke }) => {
      const s = merke(rauschQuelle());
      const hp = filter("highpass", 2600, 0.7);
      const g = verst(0.06);
      s.connect(hp).connect(g).connect(aus);
      const bp = filter("bandpass", 3400, 15);
      const bg = verst(0.12);
      s.connect(bp).connect(bg).connect(aus);
      return { setze: (k) => { glatt(g.gain, 0.02 + 0.1 * k); glatt(bg.gain, 0.04 + 0.2 * k); } };
    }),
    "a-grillen": () => schleifeBauen(({ aus, takt }) => {
      let k = 0.5;
      takt(() => {
        if (Math.random() > 0.5 + k * 0.4) return;
        const t = ctx.currentTime + 0.01;
        for (let i = 0; i < 4; i += 1) ton(4300 + Math.random() * 300, t + i * 0.035, { r: 0.025, laut: 0.025, ziel: aus });
      }, 260);
      return { setze: (w) => { k = w; } };
    }),
    "a-weltraum": () => schleifeBauen(({ aus, merke }) => {
      const g = verst(0.03);
      g.connect(aus);
      [110, 165, 220.5, 330.2].forEach((f, i) => {
        const o = merke(osz(i % 2 ? "triangle" : "sine", f));
        const og = verst(0.5);
        const l = merke(osz("sine", 0.07 + i * 0.03));
        const lg = verst(0.4);
        l.connect(lg).connect(og.gain);
        o.connect(og).connect(g);
      });
      return { setze: (k) => glatt(g.gain, 0.01 + 0.06 * k) };
    }),
    "a-kessel": () => schleifeBauen(({ aus, merke, takt }) => {
      const s = merke(rauschQuelle());
      const lp = filter("lowpass", 220, 0.7);
      const g = verst(0.3);
      s.connect(lp).connect(g).connect(aus);
      let k = 0.5;
      takt(() => {
        if (Math.random() < 0.3 + 0.5 * k) ton(200 + Math.random() * 300, ctx.currentTime + 0.01, { f2: 500 + Math.random() * 400, gleit: 0.04, r: 0.05, laut: 0.06, ziel: aus });
      }, 110);
      return { setze: (w) => { k = w; } };
    }),
    "a-zug": () => schleifeBauen(({ aus, merke, takt }) => {
      const o = merke(osz("sine", 48));
      const og = verst(0.05);
      o.connect(og).connect(aus);
      let k = 0.5;
      let n = 0;
      let warte = 0;
      takt(() => {
        warte -= 25;
        if (warte > 0) return;
        warte = 1000 / (2 + 6 * k);
        rausch(ctx.currentTime + 0.01, { dauer: 0.08, f: n % 2 ? 450 : 650, q: 1, r: 0.07, laut: n % 4 === 0 ? 0.22 : 0.12, ziel: aus });
        n += 1;
      }, 25);
      return { setze: (w) => { k = w; } };
    }),
    "a-propeller": () => schleifeBauen(({ aus, merke }) => {
      const o = merke(osz("sawtooth", 90));
      const lp = filter("lowpass", 700, 0.8);
      const g = verst(0.05);
      const am = merke(osz("sine", 18));
      const ag = verst(0.04);
      am.connect(ag).connect(g.gain);
      o.connect(lp).connect(g).connect(aus);
      return { setze: (k) => { glatt(o.frequency, 70 + 50 * k); glatt(am.frequency, 12 + 14 * k); glatt(lp.frequency, 400 + 900 * k); } };
    }),
    // k = wie schnell die Zeit läuft: 0 Stillstand (langsamer Herzschlag), 1 normal.
    "a-herz": () => schleifeBauen(({ aus, takt }) => {
      let k = 0.3;
      let warte = 0;
      takt(() => {
        warte -= 50;
        if (warte > 0) return;
        warte = 1000 / (0.8 + 1.6 * k);
        const t = ctx.currentTime + 0.01;
        ton(65, t, { f2: 40, gleit: 0.1, r: 0.16, laut: 0.4, ziel: aus });
        ton(58, t + 0.2, { f2: 38, gleit: 0.1, r: 0.16, laut: 0.28, ziel: aus });
      }, 50);
      return { setze: (w) => { k = w; } };
    }),
    // Der Balken wächst: eine Ratsche, die mit k höher klingt.
    ratsche: () => schleifeBauen(({ aus, takt }) => {
      let k = 0.5;
      let f = 600;
      takt(() => { f = f > 1400 ? 600 : f * 1.03; ton(f + 400 * k, ctx.currentTime + 0.01, { typ: "square", r: 0.015, laut: 0.04, tief: 3000, ziel: aus }); }, 70);
      return { setze: (w) => { k = w; } };
    }),
    // Der Frosch lädt: ein Ton, der mit der Ladung k steigt.
    aufladen: () => schleifeBauen(({ aus, merke }) => {
      const o = merke(osz("triangle", 200));
      const g = verst(0.08);
      const trem = merke(osz("sine", 8));
      const tg = verst(0.03);
      trem.connect(tg).connect(g.gain);
      o.connect(g).connect(aus);
      return { setze: (k) => { glatt(o.frequency, 200 + 620 * k, 0.04); glatt(trem.frequency, 6 + 18 * k); } };
    }),
  };

  // ---------------------------------------------------------------------------
  // Aufnahmen
  // ---------------------------------------------------------------------------
  const puffer = new Map();   // datei → AudioBuffer
  const laden = new Map();    // datei → Promise
  const FASSUNG = (document.currentScript?.src.match(/[?&]v=([^&]+)/) || [])[1] || "";

  function ladeDatei(datei) {
    if (puffer.has(datei)) return Promise.resolve(puffer.get(datei));
    if (laden.has(datei)) return laden.get(datei);
    const c = ctx || kontext();
    if (!c) return Promise.resolve(null);
    const p = fetch(`klang/${datei}.mp3${FASSUNG ? `?v=${FASSUNG}` : ""}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((roh) => new Promise((ok, nein) => c.decodeAudioData(roh, ok, nein)))
      .then((b) => { puffer.set(datei, b); return b; })
      .catch(() => { laden.delete(datei); return null; });
    laden.set(datei, p);
    return p;
  }

  function vorladen(bereich) {
    if (!bereich || !kontext()) return;
    const dateien = new Set();
    for (const [id, p] of Object.entries(PLAETZE)) if (p.d && id.startsWith(`${bereich}.`)) dateien.add(p.d);
    dateien.forEach((d) => { ladeDatei(d); });
  }

  // ---------------------------------------------------------------------------
  // ton() und kulisse()
  // ---------------------------------------------------------------------------
  // Für die Prüfung: was zuletzt geklungen hat.
  const protokoll = [];
  function merkeIn(id, art) {
    protokoll.push({ id, art, ms: Math.round(performance.now()) });
    if (protokoll.length > 300) protokoll.splice(0, protokoll.length - 300);
  }

  function spieleSynth(name, t, o, ziel) {
    const g = ctx.createGain();
    g.gain.value = db(PEGEL[name]) * (o.laut ?? 1);
    g.connect(ziel);
    const alt = bus;
    bus = g;
    try { SYNTH[name](t, o); } finally { bus = alt; }
    window.setTimeout(() => { try { g.disconnect(); } catch { /* weg */ } }, 8000);
  }

  function spielePuffer(b, t, o, ziel) {
    const s = ctx.createBufferSource();
    s.buffer = b;
    const streuung = o.streuung ?? 0.06;
    s.playbackRate.value = (o.hoehe || 1) * (1 + (Math.random() - 0.5) * streuung);
    const g = ctx.createGain();
    g.gain.value = o.laut ?? 1;
    s.connect(g).connect(ziel);
    s.start(t);
  }

  // Heisst nicht ton(): So heisst oben der Baustein der erzeugten Klänge,
  // und zwei Funktionen gleichen Namens überschreiben sich still.
  function spieleTon(id, o = {}) {
    const platz = PLAETZE[id];
    merkeIn(id, "ton");
    if (!platz || platz.schleife) return;
    const c = kontext();
    if (!c) return;
    try {
      const warte = Math.max(0, Number(o.verzoegerung) || 0);
      const t = c.currentTime + 0.005 + warte;
      if (platz.s) { spieleSynth(platz.s, t, o, effekte); return; }
      const b = puffer.get(platz.d);
      if (b) spielePuffer(b, t, o, effekte);
      // Noch nicht geladen (die erste Runde gleich nach dem Öffnen): laden
      // und nur dann nachholen, wenn es kaum zu spät ist – zur verlangten Zeit.
      else {
        const seit = performance.now();
        ladeDatei(platz.d).then((x) => {
          const vorbei = (performance.now() - seit) / 1000;
          if (x && vorbei < warte + 0.15) spielePuffer(x, c.currentTime + 0.005 + Math.max(0, warte - vorbei), o, effekte);
        });
      }
    } catch { /* ein Klang darf nie ein Spiel anhalten */ }
  }

  const laufend = new Map(); // id → Kulisse

  // Eine Kulisse, die nichts tut – ohne Ton, ohne Web Audio.
  const STUMM = { setze() {}, laut() {}, stop() {}, laeuft: false };

  function kulisse(id, { laut: startLaut = 1 } = {}) {
    const platz = PLAETZE[id];
    if (!platz || !platz.schleife) return STUMM;
    if (laufend.has(id)) return laufend.get(id);
    const c = kontext();
    if (!c) return STUMM;
    merkeIn(id, "kulisse");
    let k = 0.5;
    // Was stumm beginnt (Brenner, Schub, Reifen), startet mit laut: 0.
    let lautheit = Math.max(0, Math.min(1.5, Number(startLaut) || 0));
    let quelle = null;    // Aufnahme: AudioBufferSourceNode
    let bau = null;       // erzeugt: { setze, aufraeumen }
    let gestoppt = false;
    const pegel = platz.s ? db(PEGEL_SCHLEIFE[platz.s]) : 1;
    const huelle = c.createGain();
    huelle.gain.value = 0.0001;
    huelle.connect(kulissen);
    const ziel = () => pegel * lautheit * (platz.d ? (platz.tempo ? 0.75 + 0.5 * k : 0.6 + 0.8 * k) : 1);
    const blende = () => huelle.gain.setTargetAtTime(Math.max(0.0001, ziel()), c.currentTime, 0.08);

    function anwenden() {
      if (bau) bau.setze(k);
      if (quelle && platz.tempo) quelle.playbackRate.setTargetAtTime(0.8 + 0.5 * k, c.currentTime, 0.1);
      blende();
    }

    if (platz.s) {
      const alt = bus;
      bus = huelle;
      try { bau = SCHLEIFE[platz.s](); } finally { bus = alt; }
      anwenden();
    } else {
      ladeDatei(platz.d).then((b) => {
        if (!b || gestoppt) return;
        quelle = c.createBufferSource();
        quelle.buffer = b;
        quelle.loop = true;
        quelle.connect(huelle);
        quelle.start(c.currentTime, Math.random() * b.duration);
        anwenden();
      });
    }

    const k_ = {
      laeuft: true,
      setze(wert) {
        const neu = Math.max(0, Math.min(1, Number(wert) || 0));
        if (Math.abs(neu - k) < 0.005) return;
        k = neu;
        anwenden();
      },
      laut(wert) {
        const neu = Math.max(0, Math.min(1.5, Number(wert) || 0));
        if (Math.abs(neu - lautheit) < 0.005) return;
        lautheit = neu;
        blende();
      },
      stop() {
        if (gestoppt) return;
        gestoppt = true;
        k_.laeuft = false;
        laufend.delete(id);
        huelle.gain.setTargetAtTime(0.0001, c.currentTime, 0.08);
        window.setTimeout(() => {
          try { quelle?.stop(); } catch { /* schon aus */ }
          bau?.aufraeumen();
          try { huelle.disconnect(); } catch { /* weg */ }
        }, 500);
      },
    };
    laufend.set(id, k_);
    return k_;
  }

  // Ob eine Kulisse läuft – ohne sie zu starten.
  const laeuft = (id) => laufend.has(id);

  // Alle Kulissen aus – die Tafel kommt, die Runde ist vorbei.
  function stille() {
    [...laufend.values()].forEach((x) => x.stop());
  }

  // ---------------------------------------------------------------------------
  // Knöpfe ausserhalb des Spiels
  // ---------------------------------------------------------------------------
  // Ein leiser Klick auf jedem Knopf der Oberfläche: Leiste, Tafel, Fenster,
  // Startseite. Nicht im Spielfeld (dort klingt das Spiel selbst) und nicht im
  // Adminbereich.
  document.addEventListener("click", (e) => {
    const knopf = e.target?.closest?.("button, [role='button']");
    if (!knopf || knopf.disabled) return;
    if (document.body?.dataset?.seite === "admin" || location.pathname.includes("admin")) return;
    if (knopf.closest(".cm-play") && !knopf.closest(".cm-overlay")) return;
    if (knopf.closest(".ar-fenster-zu")) return; // das Fenster klingt selbst
    spieleTon("knopf");
  }, { capture: true, passive: true });

  // Vorladen, sobald die Seite Ruhe hat – die Aufnahmen des Spiels und der
  // Weg zum Lautsprecher samt Rauschen. Sonst baut der erste Klang einer
  // Runde all das mitten in einem Bild auf (im Replay ein spürbarer Ruck).
  const spaeter = window.requestIdleCallback || ((fn) => window.setTimeout(fn, 400));
  spaeter(() => {
    const b = BEREICH[document.body?.dataset?.spiel || ""];
    if (!b) return;
    vorladen(b);
    if (ctx) rauschen();
  });

  window.ArcadeKlang = { ton: spieleTon, kulisse, laeuft, stille, vorladen, PLAETZE, protokoll };
})();
