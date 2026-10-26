/*
 * kranhafen.js – Kranhafen: Container auf ein fahrendes Schiff stapeln.
 *
 * Über dem Hafenbecken liegt eine Kranbrücke. An ihrer Laufkatze hängt ein
 * Container am Seil und pendelt, die Laufkatze fährt dazu langsam hin und
 * her, und unten schaukelt ein Containerschiff unter dem Kran durch. Ein Tipp
 * lässt den Container los: Er fällt mit dem Schwung, den er gerade hat. Wer
 * genau über dem Schiff loslässt, trifft daneben – man muss vorhalten, für
 * das Pendel und für das Schiff. Das ist das ganze Spiel.
 *
 * Liegt der Schwerpunkt über dem Container darunter (beim ersten über der
 * Luke), bleibt er stehen, rutscht noch ein Stück, und der Stapel wackelt.
 * Sonst kippt er über die Kante ins Wasser, und die Runde ist vorbei. Genau
 * in der Mitte ist "perfekt", mehrere hintereinander sind eine Reihe. Ist ein
 * Schiff voll (fünf bis acht Plätze, aus der Saat), tutet es und legt ab, und
 * das nächste läuft ein. Gezählt werden die gestapelten Container.
 *
 * Schwerer wird es mit jedem Container: Das Pendel schwingt weiter und
 * schneller, die Laufkatze fährt weiter, jedes neue Schiff schaukelt stärker,
 * und ab dem dritten Schiff kommt Wind dazu – das Seil hängt dann schräg, und
 * der fallende Container treibt ab. Wer hoch stapelt, merkt auch das Rollen
 * des Schiffs: Oben auf dem Stapel schwankt es am meisten.
 *
 * Die Welt kommt ganz aus dem Zufall (zufall.js), Schiff für Schiff und
 * Container für Container im Voraus gewürfelt (planBauen) – im Turnier hat
 * jeder dieselben Schiffe und dieselben Pendel. Alles, was sich bewegt, ist
 * eine Rechnung über die Uhr der Runde (state.uhr): Wo das Schiff ist, wo die
 * Laufkatze und das Pendel, folgt aus der Zeit, nicht aus dem Bild davor. Nur
 * der fallende Container wird in festen kleinen Schritten gerechnet (TAKT) –
 * so fällt er auf jedem Gerät gleich.
 *
 * Gegner: wie im Turmbau als Zielmarke (geist.js, art "ziel"). Oben links
 * steht, wie viele Container Platz 1 und die eigene Bestmarke haben, und
 * liegt die Marke auf dem Schiff unter dem Kran, leuchtet sie als Strich
 * neben dem Stapel.
 *
 * Zuschauen (Multiplayer und Hall of Fame): Züge wie im Turmbau (meldeZug).
 * Wer zuschaut, hat dieselbe Uhr wie der andere (zuschauer.jetzt), sieht also
 * dasselbe Pendel und dasselbe Schiff, lässt den Container dort los, wo der
 * andere ihn losgelassen hat, und stellt ihn dorthin, wo er bei ihm stehen
 * blieb.
 *
 * Gezeichnet wird auf eine Leinwand: Himmel zur blauen Stunde, der mit jedem
 * Container dunkler wird, Stadt und Containerberge in Parallaxe, Wasser mit
 * Spiegelungen, ein Lichtkegel unter der Laufkatze. Was sich nicht bewegt,
 * ist einmal je Bildgrösse vorgemalt (vorrendern).
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "harbor") return;

  const host = document.querySelector("#kh-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  // Wer weniger Bewegung eingestellt hat, bekommt keinen Stoss aufs Bild, kein
  // Nachziehen der Kamera und weniger Funken. Das Pendel pendelt trotzdem –
  // das ist das Spiel, nicht die Zierde.
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());
  const klang = () => window.ArcadeKlang || null;

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; im Turnier
  // und im Live-Modus bekommt jeder dieselben Schiffe und Pendel (zufall.js).
  // Funken, Möwen und Spritzer würfeln weiter Math.random.
  const zufall = window.LernappZufall?.fuer?.("craneHarbor") || { neu() {}, zahl: () => Math.random() };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  // In Einheiten, y nach oben, der Nullpunkt liegt auf dem Wasserspiegel
  // unter der Mitte des Krans. Die Masse sind fest: Auf einem breiten Bild
  // steht mehr Hafen daneben, das Spiel selbst ist überall gleich gross.
  const WELT_W = 320;              // so breit ist das Bild mindestens
  const KISTE_W = 48;              // ein Zwanzig-Fuss-Container von der Seite
  const KISTE_H = 20;
  const LUKE_Y = 22;               // Oberkante der Luke beim leeren Schiff
  const DECK_Y = 16;               // das Deck daneben
  const SINK = 3.5;                // so viel tiefer liegt ein volles Schiff
  const FALL_H = 84;               // so hoch über dem Stapel hängt der Container
  const SPREADER_H = 5;            // der Rahmen, der den Container hält
  const KATZE_Y = 300;             // Seilrollen unter der Laufkatze
  const BRUECKE_U = 318;           // Unterkante der Kranbrücke
  const BRUECKE_O = 356;
  const BEIN_X = 252;              // die Kranbeine, hinten am Becken
  const UFER_Y = 8;                // Fuss der Stadt am anderen Ufer
  // Was immer im Bild steht: unten etwas Wasser, oben bis über den höchsten
  // Container am Seil – das unter den Knöpfen. Laufkatze und Brücke dürfen
  // auf einem flachen Bild unter die Leiste reichen, sogar aus dem Bild.
  const SICHT_U = -14;
  const SICHT_WICHTIG = 282;
  const SICHT_O = 358;

  // ---------------------------------------------------------------------------
  // Fallen und Landen
  // ---------------------------------------------------------------------------
  // Der Container fällt rund eine halbe Sekunde. Wer bei voller Fahrt des
  // Pendels loslässt, landet gut eine Containerbreite weiter – darum geht es.
  const TAKT = 1 / 240;            // der Fall in festen Schritten
  const FALL_G = 760;              // Schwerkraft, Einheiten je Sekunde²
  const WIND_FALL = 0.8;           // wie stark der Wind den fallenden Container treibt
  const RUTSCH_K = 0.05;           // so weit rutscht er je Einheit Restfahrt
  const RUTSCH_MAX = 6;
  const PERFEKT = 2.6;             // so nah an der Mitte ist "perfekt"
  const KNAPP = 6;                 // so nah an der Kante ist "knapp"

  // ---------------------------------------------------------------------------
  // Der Ablauf
  // ---------------------------------------------------------------------------
  const EINZUG = 0.4;              // so lange senkt sich ein neuer Container ab
  const HUELLE = 0.7;              // in dieser Zeit wächst das Pendeln an
  const KATZE_GLEIT = 0.9;         // so lange gleitet die Laufkatze in ihre neue Bahn
  const ANKUNFT = 2.2;             // so lange braucht ein neues Schiff herein
  // Nach einem vollen Schiff wartet der Kran auf das nächste: Loslassen geht
  // erst, wenn es ganz da ist.
  const NEUES_SCHIFF = ANKUNFT - EINZUG;
  const ABFAHRT_A = 70;            // so kräftig legt ein volles Schiff ab
  const ENDE_MS = 1300;            // vom Platscher bis zur Tafel
  const NACHT_KISTEN = 36;         // nach so vielen Containern ist tiefe Nacht
  const LUPE_K = 0.3;              // Zeitlupe: so schnell läuft es dann
  const LUPE_ZEIT = 0.6;
  const SCHIFF_VORRAT = 80;
  const KISTEN_VORRAT = 500;
  const TEILE_MAX = 260;

  /*
   * Die Kurven, an denen das Spiel hängt (planBauen). Am Anfang pendelt der
   * Container in einem kurzen, langsamen Bogen über einem fast stillen
   * Schiff – wer bei voller Fahrt loslässt, landet trotzdem noch auf der
   * Luke. Mit jedem Container wird der Bogen weiter und schneller, ab dem
   * achten zittert das Tempo ein wenig (sonst liesse sich der Takt auswendig
   * lernen), die Laufkatze fährt weitere Wege. Jedes Schiff schaukelt weiter
   * und rollt stärker als das davor, und ab dem dritten bläst oft Wind.
   * Alles ist gedeckelt: ab etwa dreissig Containern ist es schwer, aber
   * nie unmöglich – an den Umkehrpunkten des Pendels steht der Container
   * immer einen Moment still.
   */
  function planBauen() {
    const r = () => zufall.zahl();
    const schiffe = [];
    for (let k = 0; k < SCHIFF_VORRAT; k += 1) {
      const platz = 5 + Math.floor(r() * 4);
      const weite = Math.min(68, 6 + k * 12) * (0.8 + 0.4 * r());
      const periode = Math.max(5.4, 11 - k * 0.85) * (0.88 + 0.24 * r());
      const phase = r() * Math.PI * 2;
      const roll = Math.min(0.024, 0.005 + k * 0.0035) * (0.8 + 0.4 * r());
      const rollPeriode = 2.6 + r() * 1.3;
      const rollPhase = r() * Math.PI * 2;
      const windWurf = r();
      const windSeite = r() < 0.5 ? -1 : 1;
      const windMass = r();
      const windAn = k >= 2 && windWurf < Math.min(0.8, 0.3 + k * 0.08);
      const wind = windAn ? windSeite * (0.05 + Math.min(0.08, (k - 2) * 0.016)) * (0.7 + 0.3 * windMass) : 0;
      const stil = Math.floor(r() * SCHIFF_STILE.length);
      const name = Math.floor(r() * SCHIFF_NAMEN.length);
      // Das erste Schiff hat immer fünf Plätze: der erste Erfolg kommt bald.
      schiffe.push({ platz: k === 0 ? 5 : platz, weite, periode, phase, roll, rollPeriode, rollPhase, wind, stil, name });
    }
    const kisten = [];
    let farbe = 0;
    for (let n = 0; n < KISTEN_VORRAT; n += 1) {
      // Nie zweimal dieselbe Farbe übereinander.
      farbe = (farbe + 1 + Math.floor(r() * (FARBEN.length - 1))) % FARBEN.length;
      const weite = (15 + Math.min(29, n * 1.05)) * (0.85 + 0.3 * r());
      let periode = Math.max(1.4, 2.7 * Math.pow(0.973, n));
      const zitter = r();
      if (n >= 8) periode *= 0.92 + 0.16 * zitter;
      const seite = r() < 0.5 ? -1 : 1;
      const kWeite = Math.min(36, 4 + n * 1.4) * (0.75 + 0.5 * r());
      const kPeriode = Math.max(4.2, 9 - n * 0.14) * (0.85 + 0.3 * r());
      const kPhase = r() * Math.PI * 2;
      const kMitte = (r() - 0.5) * Math.min(30, n * 1.5);
      const nummer = 100000 + Math.floor(r() * 900000);
      kisten.push({ farbe, weite, periode, seite, kWeite, kPeriode, kPhase, kMitte, nummer });
    }
    return { schiffe, kisten };
  }

  // ---------------------------------------------------------------------------
  // Farben und Namen
  // ---------------------------------------------------------------------------
  // Kräftige Containerfarben, jede mit ihrer Reederei und ihrem Zeichen.
  const FARBEN = [
    { grund: "#d8432f", text: "#ffffff", firma: "KHL", kurz: "KHLU" },
    { grund: "#2f6fd1", text: "#ffffff", firma: "OCEANA", kurz: "OCNU" },
    { grund: "#2e9b58", text: "#ffffff", firma: "GRÜNLINE", kurz: "GRLU" },
    { grund: "#f08a24", text: "#ffffff", firma: "ALPINA", kurz: "ALPU" },
    { grund: "#f2c230", text: "#3a2a00", firma: "SUNCO", kurz: "SUNU" },
    { grund: "#1aa3a3", text: "#ffffff", firma: "TEALINE", kurz: "TELU" },
    { grund: "#7b4cc4", text: "#ffffff", firma: "MÖWE", kurz: "MOWU" },
    { grund: "#e7ebef", text: "#1f3b63", firma: "POLAR", kurz: "POLU" },
    { grund: "#c23d7e", text: "#ffffff", firma: "MAGNA", kurz: "MAGU" },
  ];

  const SCHIFF_STILE = [
    { rumpf: "#24589c", schorn: "#e76f51", band: "#ffffff", firma: "KH LINES" },
    { rumpf: "#2f7d5b", schorn: "#f2c14e", band: "#2f7d5b", firma: "NORDCARGO" },
    { rumpf: "#3a3f4b", schorn: "#d62828", band: "#ffffff", firma: "ELBEFRACHT" },
    { rumpf: "#a8322a", schorn: "#2b2d42", band: "#f6bd60", firma: "HANSA FEEDER" },
    { rumpf: "#1f7a8c", schorn: "#e9c46a", band: "#1f7a8c", firma: "SEA LINK" },
  ];
  const SCHIFF_NAMEN = ["MÖWE", "NORDLICHT", "KORMORAN", "SEESTERN", "POLARIS", "AURORA", "ALBATROS", "HANNA", "ELBE", "LOTSE", "KOMET", "WALROSS"];

  // Die blaue Stunde: Am Anfang glüht der Horizont noch, nach NACHT_KISTEN
  // Containern ist tiefe Nacht.
  const HIMMEL = [
    { t: 0, oben: "#1c2a57", mitte: "#4a5694", unten: "#f0a070" },
    { t: 0.35, oben: "#141f47", mitte: "#33407a", unten: "#b9687a" },
    { t: 0.7, oben: "#0a1230", mitte: "#1d2752", unten: "#4b3f6e" },
    { t: 1, oben: "#04060f", mitte: "#0b1230", unten: "#1a2446" },
  ];

  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.kranhafen", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
    : {
      read: () => ({ runs: 0, scores: [] }),
      write(data) { return data; },
      update(fn) { return fn(this.read()); },
      onChange() { return () => {}; },
    };

  function recordRun(score) {
    return store.update((old) => ({
      runs: (Number(old.runs) || 0) + 1,
      scores: [...(old.scores || []), score].sort((a, b) => b - a).slice(0, TOP_COUNT),
    }));
  }

  // ---------------------------------------------------------------------------
  // Kleine Rechnungen
  // ---------------------------------------------------------------------------
  const clamp = (wert, min, max) => Math.max(min, Math.min(max, wert));

  // Weiche Überblendung zwischen 0 und 1 – ohne Knick an den Enden.
  function sanft(von, bis, wert) {
    const k = clamp((wert - von) / (bis - von || 1), 0, 1);
    return k * k * (3 - 2 * k);
  }

  // Immer dieselbe Zahl zu derselben Eingabe: Häuser und Sterne stehen bei
  // jedem Neustart am selben Platz.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function rgb(hex) {
    const h = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }

  function misch(a, b, k) {
    const x = rgb(a);
    const y = rgb(b);
    return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, "0")).join("")}`;
  }

  const ton = (hex, k) => (k < 0 ? misch(hex, "#000000", -k) : misch(hex, "#ffffff", k));

  function rgba(hex, a) {
    const [r, gr, b] = rgb(hex);
    return `rgba(${r}, ${gr}, ${b}, ${a})`;
  }

  // Die drei Himmelsfarben zur Nacht t (0 = blaue Stunde, 1 = Nacht).
  function himmelFarben(t) {
    let i = 0;
    while (i < HIMMEL.length - 2 && t > HIMMEL[i + 1].t) i += 1;
    const von = HIMMEL[i];
    const bis = HIMMEL[i + 1];
    const k = clamp((t - von.t) / (bis.t - von.t), 0, 1);
    const unten = misch(von.unten, bis.unten, k);
    const oben = misch(von.oben, bis.oben, k);
    return {
      oben,
      mitte: misch(von.mitte, bis.mitte, k),
      unten,
      // Das Wasser spiegelt den Himmel, nur dunkler.
      wasserOben: misch(unten, "#0c1830", 0.55),
      wasserUnten: misch(oben, "#020610", 0.55),
      dunst: unten,
    };
  }

  const STERNE = [...Array(130).keys()].map((i) => ({
    x: hash01(i * 3.7),
    y: Math.pow(hash01(i * 7.3 + 1), 1.4),
    r: 0.5 + hash01(i * 11.1) * 1.1,
    ph: hash01(i * 5.5) * Math.PI * 2,
    v: 1 + hash01(i * 2.2) * 2.5,
  }));

  const WOLKEN = [...Array(5).keys()].map((i) => ({
    x: hash01(i * 2.3 + 0.4),
    y: 0.12 + hash01(i * 9.1) * 0.42,
    gross: 0.7 + hash01(i * 4.4) * 0.8,
    v: 0.004 + hash01(i * 6.6) * 0.006,
  }));

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit"    der Container pendelt, noch ist nichts gefallen
  //        "spiel"     es wird gestapelt
  //        "ende"      der Container liegt im Wasser, die Tafel kommt gleich
  //        "zuschauen" der Lauf eines anderen, Zug um Zug
  const state = {
    phase: "bereit",
    punkte: 0,
    combo: 0,
    plan: { schiffe: [], kisten: [] },
    uhr: 0,               // die Uhr der Runde, in Sekunden
    uhrVersatz: 0,        // so weit lief die Uhr schon, als die Runde begann
    losMs: 0,
    zeit: 0,              // die Uhr der Zierde (läuft in der Zeitlupe langsamer)
    schiffNr: 0,
    schiff: null,
    stapel: [],           // was auf dem Schiff unter dem Kran steht
    abfahrt: [],          // volle Schiffe auf dem Weg hinaus
    kiste: null,          // der Container am Seil (oder im Fall)
    letzte: { off: 0, einschlag: 0 },
    katze: 0,             // wo die Laufkatze gerade steht
    haken: { x: 0, y: KATZE_Y - SPREADER_H - 2, vx: 0, vy: 0, zu: false },
    wracks: [],
    teile: [],
    wellen: [],
    texte: [],
    moewen: [],
    fehler: null,         // wo der letzte Container hätte stehen sollen
    wackel: 0,            // der Stapel schwankt nach einem Aufprall
    wackelV: 0,
    bob: 0,               // das Schiff taucht beim Aufprall kurz ein
    bobV: 0,
    stoss: 0,
    lupe: 0,
    himmel: 0,
    camX: 0,
    rauch: 0,
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let prompt = null;
  let frame = null;
  let last = 0;
  let stepTimer = null;
  // Die Gegner (geist.js). Wie im Turmbau stehen sie als Zielmarke da: wie
  // viele Container ihr bester Lauf hatte.
  let gegner = null;
  // Die Aufzeichnung der Züge (geist.js, zuege): Mit ihr lässt sich der Lauf
  // später aus der Hall of Fame anschauen.
  let aufnahme = null;
  // Wem zugeschaut wird und bis zu welchem seiner Züge das Bild schon steht.
  let zuschauer = null;
  let gesehenBis = -Infinity;

  const view = {
    s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, w: WELT_W, h: 400,
    wasserY: 0, f: 1, ox: 0, oy: 0, spiegel: false,
  };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Wo was ist – alles aus der Uhr
  // ---------------------------------------------------------------------------
  // Das Schiff: Es läuft ein (von rechts, bremsend) und schaukelt dann in
  // seinem Bogen unter dem Kran hin und her. Wie weit draussen es anfängt,
  // hängt an der Bildbreite – loslassen lässt sich erst, wenn es da ist.
  function schiffX(sch, uhr) {
    const t = uhr - sch.spawn;
    const p = sch.plan;
    let x = p.weite * Math.sin((Math.PI * 2 * t) / p.periode + p.phase);
    if (t < ANKUNFT) x += sch.einX * Math.pow(1 - clamp(t / ANKUNFT, 0, 1), 3);
    return x;
  }

  const schiffV = (sch, uhr) => (schiffX(sch, uhr + 0.001) - schiffX(sch, uhr - 0.001)) / 0.002;

  // Das Rollen: um die Wasserlinie unter der Luke. Oben auf einem hohen Stapel
  // macht das einige Einheiten aus.
  function schiffRoll(sch, uhr) {
    const p = sch.plan;
    return p.roll * Math.sin((Math.PI * 2 * (uhr - sch.spawn)) / p.rollPeriode + p.rollPhase);
  }

  // Ein volles Schiff fährt ab: erst mit der Fahrt, die es hatte, dann immer
  // schneller nach links hinaus.
  function abfahrtX(a, uhr) {
    const t = Math.max(0, uhr - a.t0);
    return a.x0 + a.v0 * t - 0.5 * ABFAHRT_A * t * t;
  }

  const deckY = (sch, anzahl) => LUKE_Y - (SINK * anzahl) / sch.plan.platz;
  const spitzeY = () => deckY(state.schiff, state.stapel.length) + state.stapel.length * KISTE_H;
  const spitzeOff = () => (state.stapel.length ? state.stapel[state.stapel.length - 1].off : 0);

  // Die Mitte dessen, worauf der Container landen muss, in der Welt – mit
  // dem Rollen des Schiffs.
  function stuetzeX(uhr) {
    const sch = state.schiff;
    const r = schiffRoll(sch, uhr);
    return schiffX(sch, uhr) + spitzeOff() * Math.cos(r) - spitzeY() * Math.sin(r);
  }

  // Die Laufkatze: Mit jedem neuen Container bekommt sie eine neue Bahn und
  // gleitet aus der alten hinein, ohne Sprung. Vor seinem Einzug (beim
  // Warten auf ein Schiff) fährt sie die alte Bahn weiter.
  function katzeBei(kiste, uhr) {
    let k = kiste;
    if (uhr < k.spawn && k.alt) k = k.alt;
    const p = k.plan;
    const t = uhr - k.spawn;
    const ziel = p.kMitte + p.kWeite * Math.sin((Math.PI * 2 * t) / p.kPeriode + p.kPhase);
    return k.von + (ziel - k.von) * sanft(0, KATZE_GLEIT, t);
  }

  // Das Pendel, als Auslenkung des Containers unter der Laufkatze. Es fängt
  // an einem Umkehrpunkt an und wächst in HUELLE Sekunden auf seine Weite.
  // Der Wind schiebt die Mitte des Bogens zur Seite: Das Seil hängt schräg.
  function pendelBei(kiste, uhr) {
    const t = uhr - kiste.spawn;
    if (t <= 0) return 0;
    const p = kiste.plan;
    const schwung = p.weite * Math.sin((Math.PI * 2 * t) / p.periode + (p.seite * Math.PI) / 2);
    return sanft(0, HUELLE, t) * (schwung + kiste.windVersatz);
  }

  const kisteX = (kiste, uhr) => katzeBei(kiste, uhr) + pendelBei(kiste, uhr);
  const kisteV = (kiste, uhr) => (kisteX(kiste, uhr + 0.001) - kisteX(kiste, uhr - 0.001)) / 0.002;

  // Wie hoch die Unterkante hängt: Beim Einzug senkt sie sich von der
  // Laufkatze herab, danach FALL_H über dem Stapel.
  function kisteY(kiste, uhr) {
    const t = uhr - kiste.spawn;
    if (t >= EINZUG) return kiste.hangY;
    const oben = KATZE_Y - SPREADER_H - KISTE_H;
    const k = 1 - Math.pow(1 - clamp(t / EINZUG, 0, 1), 3);
    return oben + (kiste.hangY - oben) * k;
  }

  // Wie schräg der Container am Seil hängt – ein Viertel des Seilwinkels:
  // Die vier Seile halten den Rahmen fast waagrecht.
  const kisteNeig = (kiste, uhr) => clamp(Math.atan2(pendelBei(kiste, uhr), Math.max(10, kiste.seil)) * 0.25, -0.16, 0.16);

  const windA = (sch) => FALL_G * WIND_FALL * Math.tan(sch.plan.wind);

  // Der Augenblick des Loslassens: wo der Container ist und wie schnell –
  // waagrecht mit dem ganzen Schwung von Pendel und Laufkatze.
  function loslassDaten(kiste, uhr) {
    return {
      x: kisteX(kiste, uhr),
      y: kisteY(kiste, uhr),
      vx: kisteV(kiste, uhr),
      vy: 0,
      aw: windA(state.schiff),
      uhr,
      neig: kisteNeig(kiste, uhr),
      wartet: false,
    };
  }

  function fallSchritt(f, h) {
    f.vx += f.aw * h;
    f.vy -= FALL_G * h;
    f.x += f.vx * h;
    f.y += f.vy * h;
    f.uhr += h;
    f.neig *= 1 - 2.5 * h;
  }

  /*
   * Wie eine Landung ausgeht. d: wie weit die Mitte des Containers neben der
   * Mitte darunter aufschlägt. Mit der Restfahrt gegenüber dem Schiff rutscht
   * er noch ein Stück (ende). Steht danach der Schwerpunkt nicht mehr über
   * dem Container darunter, kippt er.
   */
  function ergebnis(f) {
    const d = f.x - stuetzeX(f.uhr);
    const vRel = f.vx - schiffV(state.schiff, f.uhr);
    const halb = KISTE_W / 2;
    if (Math.abs(d) > halb) return { d, vRel, daneben: true, ende: d };
    let ende = d + clamp(vRel * RUTSCH_K, -RUTSCH_MAX, RUTSCH_MAX);
    if (Math.abs(ende) > halb) return { d, vRel, daneben: true, ende };
    const perfekt = Math.abs(ende) <= PERFEKT;
    if (perfekt) ende = 0;
    // So genau, wie der Zug es trägt – dann steht beim Zuschauen derselbe
    // Stapel da.
    ende = Math.round(ende * 100) / 100;
    return { d, vRel, daneben: false, ende, perfekt, knapp: halb - Math.abs(ende) < KNAPP };
  }

  // Wo der Container landen würde, liesse man ihn jetzt los – für die
  // Prüfskripte (ein Autopilot), nicht fürs Bild.
  function vorhersage() {
    const k = state.kiste;
    if (!k || k.fallend || state.uhr - k.spawn < EINZUG || !state.schiff) return null;
    const f = loslassDaten(k, state.uhr);
    const ziel = spitzeY();
    for (let n = 0; n < 4000 && f.y > ziel; n += 1) fallSchritt(f, TAKT);
    return ergebnis(f);
  }

  // ---------------------------------------------------------------------------
  // Die Bühne
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "kh-platz");
    feld = shell.el("div", "kh-feld");
    canvas = document.createElement("canvas");
    canvas.className = "kh-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    // Undurchsichtig: Es wird ohnehin jedes Bild ganz übermalt, und so muss
    // der Browser die Leinwand nicht noch mit der Seite dahinter mischen.
    g = canvas.getContext("2d", { alpha: false });

    // Der Hinweis vor dem ersten Tipp: ein Ring, der sich füllt, und ein
    // Punkt darin. Er verschwindet mit dem ersten Container.
    const tipp = shell.el("span", "kh-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { r: 22, stroke: "rgba(255,255,255,0.45)", w: 5 },
      { r: 22, stroke: "#ffffff", w: 5, klasse: "kh-tipp-fuell" },
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
    punkt.setAttribute("r", "9");
    punkt.setAttribute("fill", "#ffffff");
    svg.append(punkt);
    tipp.append(svg);
    feld.append(tipp);
    platz.append(feld);
    return platz;
  }

  /*
   * Grösse der Leinwand. Das Spiel ist überall gleich gross: mindestens
   * WELT_W Einheiten in der Breite, und in der Höhe vom Wasser unter dem
   * Schiff bis zur Laufkatze – das unter den Knöpfen oben (game-shell.js,
   * frei). Ist das Bild höher, steht mehr Himmel darüber und mehr Wasser
   * darunter; ist es breiter, mehr Hafen daneben.
   */
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
    const nutzH = cssH - frei;
    // Die Brücke soll ganz im Bild stehen; liegt oben eine Leiste über der
    // Leinwand (Handy), reicht es, wenn die Laufkatze darunter noch zu sehen ist.
    const oben = frei > 20 ? BRUECKE_U + 14 : SICHT_O;
    view.s = Math.min(cssW / WELT_W, nutzH / (SICHT_WICHTIG - SICHT_U), cssH / (oben - SICHT_U));
    view.w = cssW / view.s;
    view.h = cssH / view.s;
    // Was übrig ist, geht knapp zur Hälfte ans Wasser, der Rest an den
    // Himmel – aber erst so viel nach oben, dass die Brücke ganz im Bild ist.
    const uebrig = Math.max(0, nutzH - (SICHT_WICHTIG - SICHT_U) * view.s);
    const ganzUnten = cssH + SICHT_U * view.s;
    view.wasserY = ganzUnten - uebrig * 0.45;
    if (view.wasserY - SICHT_O * view.s < 0) view.wasserY = Math.min(ganzUnten, SICHT_O * view.s);
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    vorrendern();
  }

  // Wo der Nullpunkt der Welt auf der Leinwand liegt – mit der Kamera und dem
  // Stoss. Einmal je Bild.
  function kamera() {
    const wack = ruhig() ? 0 : state.stoss;
    const sx = Math.sin(state.zeit * 63) * 2.4 * wack;
    const sy = Math.cos(state.zeit * 71) * 3 * wack;
    view.f = view.s * view.dpr;
    view.ox = (view.cssW / 2 - state.camX * view.s + sx) * view.dpr;
    view.oy = (view.wasserY + sy) * view.dpr;
  }

  /*
   * Gezeichnet wird in kleinen Stücken, jedes mit eigenem Ursprung: ort()
   * legt ihn auf den Weltpunkt (x, y), dreht um r (gegen den Uhrzeiger) und
   * zeichnet dann wie gewohnt, y nach unten, in Einheiten. Mit view.spiegel
   * landet alles an der Wasserlinie gespiegelt – so entsteht das Spiegelbild
   * des Schiffs aus denselben Zeilen.
   */
  function ort(x, y, r = 0, sx = 1, sy = 1) {
    const f = view.f;
    let yy = y;
    let rr = r;
    let syy = sy;
    if (view.spiegel) { yy = -y; rr = -r; syy = -sy; }
    const c = Math.cos(-rr);
    const s = Math.sin(-rr);
    g.setTransform(f * sx * c, f * sx * s, -f * syy * s, f * syy * c, view.ox + x * f, view.oy - yy * f);
  }

  // Bildpunkte (CSS) für Texte und die Anzeige.
  function bildTransform() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  const bildX = (x) => view.cssW / 2 + (x - state.camX) * view.s;
  const bildY = (y) => view.wasserY - y * view.s;

  // ---------------------------------------------------------------------------
  // Vorgemalt
  // ---------------------------------------------------------------------------
  // Container, Schiffe, die Kranbrücke, Stadt und Hafen im Hintergrund und die
  // Lichtpunkte: einmal je Bildgrösse auf eigene Leinwände gemalt, im Spiel
  // nur noch hingestempelt.
  const bilder = {
    kisten: [], kistenKopf: [], bruecke: null, fern: null, mitte: null, wolke: null,
    schiffe: new Map(), glut: {},
  };

  function leinwand(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Bildpunkte je Einheit für die vorgemalten Teile: genau so viele wie auf
  // der Leinwand. Dann lässt sich jedes Teil Bildpunkt für Bildpunkt
  // hinstempeln (stempel) – ohne Strecken, ohne Glätten.
  const spriteF = () => view.s * view.dpr;

  // Dasselbe Bild kopfüber: für die Spiegelung im Wasser.
  function kopfueber(bild) {
    const c = leinwand(bild.width, bild.height);
    const cx = c.getContext("2d");
    cx.translate(0, bild.height);
    cx.scale(1, -1);
    cx.drawImage(bild, 0, 0);
    return c;
  }

  // Ein weicher Lichtpunkt, für jede Lichtfarbe einmal.
  function glutMalen(farbe) {
    const c = leinwand(64, 64);
    const cx = c.getContext("2d");
    const verlauf = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    verlauf.addColorStop(0, rgba(farbe, 1));
    verlauf.addColorStop(0.22, rgba(farbe, 0.55));
    verlauf.addColorStop(0.55, rgba(farbe, 0.14));
    verlauf.addColorStop(1, rgba(farbe, 0));
    cx.fillStyle = verlauf;
    cx.fillRect(0, 0, 64, 64);
    return c;
  }

  function wolkeMalen() {
    const c = leinwand(256, 96);
    const cx = c.getContext("2d");
    [[70, 58, 46], [118, 44, 52], [168, 56, 44], [204, 64, 30], [40, 66, 28], [128, 66, 44]].forEach(([x, y, r]) => {
      const v = cx.createRadialGradient(x, y, 0, x, y, r);
      v.addColorStop(0, "rgba(255, 226, 214, 0.55)");
      v.addColorStop(0.6, "rgba(255, 214, 200, 0.22)");
      v.addColorStop(1, "rgba(255, 214, 200, 0)");
      cx.fillStyle = v;
      cx.fillRect(0, 0, 256, 96);
    });
    return c;
  }

  // Ein Container von der Längsseite: Sicken, Rahmen, Eckbeschläge, das
  // Zeichen der Reederei und die Nummer oben rechts.
  function kisteMalen(farbe, nr, f) {
    const c = leinwand(KISTE_W * f, KISTE_H * f);
    const cx = c.getContext("2d");
    cx.scale(f, f);
    const W = KISTE_W;
    const H = KISTE_H;
    const hell = ton(farbe.grund, 0.16);
    const dunkel = ton(farbe.grund, -0.22);
    const rahmen = ton(farbe.grund, -0.38);
    cx.fillStyle = farbe.grund;
    cx.fillRect(0, 0, W, H);
    for (let x = 3; x < W - 3; x += 2.5) {
      cx.fillStyle = hell;
      cx.fillRect(x, 1.6, 0.8, H - 3.6);
      cx.fillStyle = dunkel;
      cx.fillRect(x + 1.3, 1.6, 0.6, H - 3.6);
    }
    cx.fillStyle = rahmen;
    cx.fillRect(0, 0, W, 1.6);
    cx.fillRect(0, H - 2, W, 2);
    cx.fillRect(0, 0, 2, H);
    cx.fillRect(W - 2, 0, 2, H);
    cx.fillStyle = "#1b1d22";
    [0, W - 2.4].forEach((x) => [0, H - 2.4].forEach((y) => cx.fillRect(x, y, 2.4, 2.4)));
    logoMalen(cx, nr, farbe);
    cx.fillStyle = rgba(farbe.text, 0.75);
    cx.font = "700 2.4px system-ui, sans-serif";
    cx.textAlign = "right";
    cx.textBaseline = "top";
    cx.fillText(`${farbe.kurz} ${String(4821 + nr * 977).slice(-4)}${nr}`, W - 3.2, 2.4);
    // Licht von oben: oben heller, unten dunkler.
    const v = cx.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, "rgba(255,255,255,0.2)");
    v.addColorStop(0.4, "rgba(255,255,255,0)");
    v.addColorStop(1, "rgba(0,0,0,0.3)");
    cx.fillStyle = v;
    cx.fillRect(0, 0, W, H);
    return c;
  }

  // Die Zeichen der Reedereien – einfache Formen, kein Bild.
  function logoMalen(cx, nr, farbe) {
    const t = farbe.text;
    cx.fillStyle = t;
    cx.strokeStyle = t;
    cx.lineWidth = 1;
    cx.textBaseline = "middle";
    cx.textAlign = "left";
    const name = (x, groesse) => {
      cx.font = `900 ${groesse}px system-ui, sans-serif`;
      cx.fillText(farbe.firma, x, 11.2);
    };
    switch (nr) {
      case 0:
        cx.font = "900 9px system-ui, sans-serif";
        cx.textAlign = "center";
        cx.fillText("KHL", 24, 11);
        cx.fillRect(9, 15.6, 30, 0.9);
        break;
      case 1:
        cx.beginPath(); cx.arc(11, 10.5, 4.6, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.moveTo(7, 11.4); cx.quadraticCurveTo(9, 8.4, 11, 11.4); cx.quadraticCurveTo(13, 14.2, 15, 11.2); cx.stroke();
        name(18, 4.6);
        break;
      case 2:
        cx.beginPath(); cx.moveTo(6, 16); cx.lineTo(14, 5); cx.lineTo(17, 5); cx.lineTo(9, 16); cx.closePath(); cx.fill();
        name(19, 3.9);
        break;
      case 3:
        cx.beginPath(); cx.moveTo(5, 15); cx.lineTo(10, 7); cx.lineTo(13, 11); cx.lineTo(15, 8.5); cx.lineTo(19, 15); cx.closePath(); cx.fill();
        name(21, 4.4);
        break;
      case 4:
        cx.beginPath(); cx.arc(11, 11, 3.2, 0, Math.PI * 2); cx.fill();
        for (let i = 0; i < 8; i += 1) {
          const w = (i / 8) * Math.PI * 2;
          cx.fillRect(11 + Math.cos(w) * 5 - 0.5, 11 + Math.sin(w) * 5 - 0.5, 1, 1);
        }
        name(18, 4.8);
        break;
      case 5:
        [8, 12].forEach((x) => { cx.beginPath(); cx.arc(x, 11, 3.4, 0, Math.PI * 2); cx.stroke(); });
        name(18, 4.2);
        break;
      case 6:
        cx.lineWidth = 1.4;
        cx.beginPath(); cx.moveTo(5, 9); cx.quadraticCurveTo(8, 6.5, 11, 10.5); cx.quadraticCurveTo(14, 6.5, 17, 9); cx.stroke();
        name(20, 5.2);
        break;
      case 7:
        cx.beginPath();
        for (let i = 0; i < 10; i += 1) {
          const w = -Math.PI / 2 + (i / 10) * Math.PI * 2;
          const r = i % 2 ? 2 : 4.8;
          cx.lineTo(11 + Math.cos(w) * r, 11 + Math.sin(w) * r);
        }
        cx.closePath(); cx.fill();
        name(18, 5);
        break;
      default:
        [6.5, 10, 13.5].forEach((y) => cx.fillRect(5, y, 11, 1.8));
        name(19, 5);
    }
  }

  // Die Kranbrücke: ein Fachwerkträger über die ganze Breite, mit Geländer
  // obendrauf und der Laufschiene unten. breite in Einheiten.
  function brueckeMalen(f) {
    const breite = view.w + 220;
    const H = BRUECKE_O - BRUECKE_U + 4;
    const c = leinwand(breite * f, H * f);
    const cx = c.getContext("2d");
    cx.scale(f, f);
    const gelb = "#eaa21c";
    // Geländer
    cx.fillStyle = "#c98a18";
    cx.fillRect(0, 0.4, breite, 0.8);
    for (let x = 2; x < breite; x += 6) cx.fillRect(x, 0.4, 0.6, 4);
    // Obergurt
    cx.fillStyle = gelb;
    cx.fillRect(0, 4, breite, 7);
    cx.fillStyle = "#ffd36b";
    cx.fillRect(0, 4, breite, 1.3);
    cx.fillStyle = "#b5770f";
    cx.fillRect(0, 9.8, breite, 1.2);
    // Fachwerk
    cx.strokeStyle = "#cf8c16";
    cx.lineWidth = 1.7;
    cx.beginPath();
    for (let x = 0; x < breite + 20; x += 20) {
      cx.moveTo(x, 11);
      cx.lineTo(x + 10, 30);
      cx.lineTo(x + 20, 11);
    }
    cx.stroke();
    cx.fillStyle = "#d8951a";
    for (let x = 0; x < breite + 20; x += 20) cx.fillRect(x - 0.8, 11, 1.6, 19);
    // Untergurt mit der Schiene, auf der die Laufkatze fährt
    cx.fillStyle = "#e09a1a";
    cx.fillRect(0, 30, breite, 6);
    cx.fillStyle = "#ffc954";
    cx.fillRect(0, 30, breite, 1);
    cx.fillStyle = "#a96c0d";
    cx.fillRect(0, 34.6, breite, 1.4);
    cx.fillStyle = "#3d424a";
    cx.fillRect(0, 36, breite, 2.6);
    cx.fillStyle = "#7d858f";
    cx.fillRect(0, 36, breite, 0.6);
    // Schild in der Mitte links
    const sx = breite / 2 - 96;
    cx.fillStyle = "#1f2a44";
    cx.fillRect(sx, 13.5, 34, 13);
    cx.fillStyle = "#f4f6fb";
    cx.font = "900 8px system-ui, sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText("KRAN 7", sx + 17, 20.4);
    // Lampengehäuse unter der Brücke (das Licht kommt im Spiel dazu)
    cx.fillStyle = "#2b2f36";
    for (let x = breite / 2 - 240; x <= breite / 2 + 240; x += 80) cx.fillRect(x - 3, 38.4, 6, 2.6);
    return { bild: c, breite, hoch: H };
  }

  /*
   * Ein Feederschiff von der Seite: Bug links, die Luke in der Mitte (dort,
   * wo gestapelt wird), Brücke und Schornstein hinten. Der Ursprung liegt
   * auf der Wasserlinie unter der Lukenmitte, gezeichnet wird y nach unten.
   * Zwei Bilder: das Schiff und seine Fenster, die nachts leuchten.
   */
  const SCHIFF_LINKS = -110;
  const SCHIFF_OBEN = -114;
  const SCHIFF_B = 224;
  const SCHIFF_H = 118;

  function schiffMalen(stilNr, nameNr) {
    const f = spriteF();
    const stil = SCHIFF_STILE[stilNr];
    const basis = leinwand(SCHIFF_B * f, SCHIFF_H * f);
    const licht = leinwand(SCHIFF_B * f, SCHIFF_H * f);
    const cx = basis.getContext("2d");
    const lx = licht.getContext("2d");
    [cx, lx].forEach((k) => { k.scale(f, f); k.translate(-SCHIFF_LINKS, -SCHIFF_OBEN); });

    // Der Rumpf
    cx.fillStyle = stil.rumpf;
    cx.beginPath();
    cx.moveTo(-106, -29);
    cx.lineTo(-76, -29);
    cx.lineTo(-74, -19);
    cx.lineTo(96, -19);
    cx.lineTo(101, -22);
    cx.lineTo(102, -6);
    cx.quadraticCurveTo(101, 3, 92, 4);
    cx.lineTo(-86, 4);
    cx.quadraticCurveTo(-97, 2, -100, -8);
    cx.closePath();
    cx.fill();
    // Licht von oben auf dem Rumpf, unten Schatten
    const v = cx.createLinearGradient(0, -29, 0, 4);
    v.addColorStop(0, "rgba(255,255,255,0.16)");
    v.addColorStop(0.5, "rgba(255,255,255,0)");
    v.addColorStop(1, "rgba(0,0,0,0.35)");
    cx.fillStyle = v;
    cx.fill();
    // Wasserpass: rot, knapp über der Linie
    cx.fillStyle = "#a3322a";
    cx.fillRect(-98, -2.6, 199, 6.6);
    cx.fillStyle = "rgba(255,255,255,0.55)";
    cx.fillRect(-98, -3.4, 199, 0.8);
    // Schanzkleid oben und Reling
    cx.fillStyle = "#f1f4f8";
    cx.fillRect(-74, -19.6, 170, 1.2);
    cx.fillRect(-106, -29.6, 30, 1.2);
    cx.fillStyle = "rgba(240,244,248,0.8)";
    cx.fillRect(-74, -23, 124, 0.5);
    for (let x = -74; x < 50; x += 4) cx.fillRect(x, -23, 0.5, 3.6);
    // Der Name der Reederei gross auf der Bordwand, Bullaugen nur hinten
    cx.fillStyle = "rgba(255, 255, 255, 0.92)";
    cx.font = "900 8px system-ui, sans-serif";
    cx.textAlign = "center";
    cx.textBaseline = "middle";
    cx.fillText(stil.firma, -14, -10.5);
    cx.fillStyle = "#0f1724";
    for (let x = 56; x < 92; x += 7) { cx.beginPath(); cx.arc(x, -11, 1.1, 0, Math.PI * 2); cx.fill(); }
    // Anker
    cx.strokeStyle = "#cfd5dd";
    cx.lineWidth = 0.9;
    cx.beginPath(); cx.moveTo(-95, -24); cx.lineTo(-95, -18); cx.moveTo(-97.5, -19.5); cx.quadraticCurveTo(-95, -16.5, -92.5, -19.5); cx.stroke();
    // Name am Bug
    cx.fillStyle = "#f4f6fb";
    cx.font = "800 4.6px system-ui, sans-serif";
    cx.textAlign = "left";
    cx.textBaseline = "middle";
    cx.fillText(SCHIFF_NAMEN[nameNr], -86, -24.6);
    // Die Luke: Süll und Deckel, mit den gelben Ecken als Ziel
    cx.fillStyle = "#56606c";
    cx.fillRect(-28, -22, 56, 6);
    cx.fillStyle = "#7c8794";
    cx.fillRect(-28, -22, 56, 1.2);
    cx.fillStyle = "#3b434d";
    for (let x = -24; x <= 24; x += 8) cx.fillRect(x - 0.3, -20.8, 0.6, 4.8);
    // Vormast mit Saling
    cx.fillStyle = "#e9edf2";
    cx.fillRect(-84.6, -64, 1.2, 35);
    cx.fillRect(-89, -56, 10, 0.9);
    // Aufbau hinten: drei Stockwerke, Brücke mit Nocken, Dach
    const weiss = "#e7ebf0";
    const grau = "#b9c1cc";
    cx.fillStyle = weiss;
    cx.fillRect(50, -42, 44, 23);
    cx.fillRect(54, -60, 38, 18);
    cx.fillRect(52, -76, 46, 16);
    cx.fillRect(97, -75, 7, 2);
    cx.fillStyle = grau;
    cx.fillRect(50, -21, 44, 2);
    cx.fillRect(54, -43, 38, 1.4);
    cx.fillRect(52, -61, 46, 1.4);
    cx.fillStyle = "#2b3442";
    cx.fillRect(51, -78, 48, 2.2);
    // Fenster (dunkel – nachts leuchten sie, siehe licht)
    const fenster = [];
    for (let x = 53; x < 91; x += 5) fenster.push([x, -37, 3, 3], [x, -30, 3, 3]);
    for (let x = 57; x < 89; x += 5) fenster.push([x, -55, 3, 3]);
    fenster.push([54, -72, 42, 4.4]);
    cx.fillStyle = "#1a2638";
    fenster.forEach(([x, y, w, h]) => cx.fillRect(x, y, w, h));
    lx.fillStyle = "#ffd58a";
    fenster.forEach(([x, y, w, h], i) => {
      if (h > 4 || hash01(i * 3.1 + stilNr) > 0.35) lx.fillRect(x, y, w, h);
    });
    // Rettungsboot
    cx.fillStyle = "#f07a22";
    cx.beginPath();
    cx.moveTo(56, -51); cx.lineTo(74, -51); cx.quadraticCurveTo(73, -46, 70, -46); cx.lineTo(60, -46); cx.quadraticCurveTo(57, -46, 56, -51);
    cx.fill();
    // Schornstein mit dem Band der Reederei
    cx.fillStyle = stil.schorn;
    cx.beginPath(); cx.moveTo(72, -78); cx.lineTo(74, -98); cx.lineTo(87, -98); cx.lineTo(86, -78); cx.closePath(); cx.fill();
    cx.fillStyle = stil.band;
    cx.fillRect(73.2, -91, 13.4, 3.2);
    cx.fillStyle = "#15181d";
    cx.fillRect(73.8, -98, 13.4, 2.6);
    // Radarmast
    cx.fillStyle = "#d9dee5";
    cx.fillRect(61.4, -108, 1.2, 30);
    cx.fillRect(56, -101, 12, 0.9);
    cx.fillStyle = "#2b3442";
    cx.fillRect(57, -106, 10, 1.4);
    // Der Umriss in Nachtblau: darübergelegt, wird das Schiff dunkler.
    const schatten = leinwand(SCHIFF_B * f, SCHIFF_H * f);
    const sx = schatten.getContext("2d");
    sx.drawImage(basis, 0, 0);
    sx.globalCompositeOperation = "source-in";
    sx.fillStyle = "#060a1c";
    sx.fillRect(0, 0, schatten.width, schatten.height);
    return { basis, licht, schatten };
  }

  /*
   * Das Schiff so, wie es bei dieser Stufe der Nacht aussieht: dunkler, die
   * Fenster heller – einmal zusammengesetzt, dann ein einziges Bild (und
   * eines kopfüber für die Spiegelung). Neu gemalt wird nur, wenn ein neues
   * Schiff einläuft oder es eine Stufe dunkler wird.
   */
  const SCHIFF_STUFEN = 8;

  function schiffBild(plan) {
    const stufe = Math.round(clamp(state.himmel, 0, 1) * SCHIFF_STUFEN);
    const schluessel = `${plan.stil}-${plan.name}-${stufe}`;
    let bild = bilder.schiffe.get(schluessel);
    if (!bild) {
      const teile = schiffMalen(plan.stil, plan.name);
      const nacht = stufe / SCHIFF_STUFEN;
      const c = leinwand(teile.basis.width, teile.basis.height);
      const cx = c.getContext("2d");
      cx.drawImage(teile.basis, 0, 0);
      cx.globalAlpha = 0.42 * nacht;
      cx.drawImage(teile.schatten, 0, 0);
      cx.globalCompositeOperation = "lighter";
      cx.globalAlpha = 0.3 + 0.7 * nacht;
      cx.drawImage(teile.licht, 0, 0);
      bild = { bild: c, kopf: kopfueber(c) };
      bilder.schiffe.set(schluessel, bild);
      // Mehr als die zwei, drei Schiffe im Bild braucht es nie.
      if (bilder.schiffe.size > 6) bilder.schiffe.delete(bilder.schiffe.keys().next().value);
    }
    return bild;
  }

  /*
   * Der Hintergrund in zwei Ebenen, beide so breit wie das Bild und ein
   * Stück mehr für die Parallaxe. Hinten die Stadt am anderen Ufer, davor
   * Containerberge, ferne Kräne und Lichtmasten am Kai gegenüber. Jede
   * Ebene hat ein zweites Bild mit ihren Lichtern – die leuchten nachts
   * heller und spiegeln sich im Wasser.
   */
  const RAND_PX = 50;

  function hintergrundMalen() {
    const d = Math.min(view.dpr, 2);
    const s = view.s;
    const breit = view.cssW + RAND_PX * 2;
    const ebene = (hochE) => {
      const hoch = hochE * s;
      const bild = leinwand(breit * d, hoch * d);
      const licht = leinwand(breit * d, hoch * d);
      const a = bild.getContext("2d");
      const b = licht.getContext("2d");
      a.scale(d, d);
      b.scale(d, d);
      return { bild, licht, a, b, hoch, breit, blinker: [] };
    };

    // --- Die Stadt ---
    const fern = ebene(150);
    {
      const { a, b, hoch } = fern;
      let x = -10;
      let i = 0;
      while (x < breit + 10) {
        const w = (10 + hash01(i * 1.7) * 22) * s * 0.7;
        let h = (12 + Math.pow(hash01(i * 2.9 + 3), 2.2) * 62) * s * 0.62;
        const turm = hash01(i * 5.3) > 0.9;
        if (turm) h *= 1.5;
        a.fillStyle = misch("#141b36", "#20294a", hash01(i * 8.8));
        a.fillRect(x, hoch - h, w, h);
        if (turm) {
          a.fillRect(x + w / 2 - 0.6 * s, hoch - h - 12 * s, 1.2 * s, 12 * s);
          b.fillStyle = "#ff4a3a";
          b.fillRect(x + w / 2 - 1, hoch - h - 12 * s - 1, 2, 2);
          fern.blinker.push({ x: x + w / 2, y: hoch - h - 12 * s, ph: hash01(i) * 6 });
        }
        // Fenster: ein Raster, zufällig erleuchtet
        const fw = 1.6 * s * 0.75;
        const fh = 2 * s * 0.75;
        for (let fy = hoch - h + 3 * s; fy < hoch - 3 * s; fy += 4.4 * s * 0.75) {
          for (let fx = x + 2 * s * 0.75; fx < x + w - 3 * s * 0.75; fx += 3.6 * s * 0.75) {
            const z = hash01(fx * 0.37 + fy * 1.13 + i);
            if (z > 0.72) {
              b.fillStyle = z > 0.93 ? "#bfe3ff" : "#ffd58a";
              b.fillRect(fx, fy, fw, fh);
            }
          }
        }
        x += w + hash01(i * 4.1) * 3 * s;
        i += 1;
      }
      // Ein Fernsehturm, damit die Stadt einen Ort hat
      const tx = breit * 0.68;
      a.fillStyle = "#1b2342";
      a.fillRect(tx - 1.3 * s, hoch - 96 * s, 2.6 * s, 96 * s);
      a.beginPath();
      a.ellipse(tx, hoch - 76 * s, 5.5 * s, 4.8 * s, 0, 0, Math.PI * 2);
      a.fill();
      a.fillRect(tx - 0.4 * s, hoch - 110 * s, 0.8 * s, 16 * s);
      b.fillStyle = "#ffe2a8";
      for (let k = -4; k <= 4; k += 2) b.fillRect(tx + k * s - 0.6, hoch - 76 * s - 0.6, 1.4, 1.4);
      fern.blinker.push({ x: tx, y: hoch - 110 * s, ph: 1.3 });
    }

    // --- Der Hafen gegenüber ---
    const mitte = ebene(120);
    {
      const { a, b, hoch } = mitte;
      const dunst = "#2a3352";
      // Containerberge
      let x = -6;
      let i = 0;
      const kw = 26 * s * 0.5;
      const kh = 11 * s * 0.5;
      while (x < breit + 6) {
        const reihe = 2 + Math.floor(hash01(i * 3.3 + 7) * 6);
        const hoeheMax = 2 + Math.floor(hash01(i * 6.1) * 4);
        for (let r = 0; r < reihe; r += 1) {
          const hoehe = Math.max(1, hoeheMax - Math.floor(hash01(i * 9 + r) * 2));
          for (let e = 0; e < hoehe; e += 1) {
            const farbe = FARBEN[Math.floor(hash01(i * 13 + r * 7 + e * 3) * FARBEN.length)].grund;
            a.fillStyle = misch(farbe, dunst, 0.62);
            a.fillRect(x + r * kw, hoch - (e + 1) * kh - 4 * s, kw - 0.6, kh - 0.6);
          }
        }
        x += reihe * kw + (8 + hash01(i * 2.2) * 30) * s;
        i += 1;
      }
      // Die Kaimauer
      a.fillStyle = "#1c2238";
      a.fillRect(0, hoch - 4 * s, breit, 4 * s);
      // Ferne Kräne
      [0.12, 0.46, 0.86].forEach((anteil, k) => {
        const cx0 = breit * anteil + (hash01(k * 7) - 0.5) * 40;
        const farbe = misch(k % 2 ? "#3c6ea8" : "#c2453a", dunst, 0.55);
        const hk = (64 + k * 6) * s * 0.6;
        a.strokeStyle = farbe;
        a.fillStyle = farbe;
        a.lineWidth = Math.max(1, 1.4 * s);
        a.beginPath();
        a.moveTo(cx0 - 12 * s, hoch - 4 * s); a.lineTo(cx0 - 8 * s, hoch - hk);
        a.moveTo(cx0 + 12 * s, hoch - 4 * s); a.lineTo(cx0 + 8 * s, hoch - hk);
        a.moveTo(cx0 - 11 * s, hoch - hk * 0.45); a.lineTo(cx0 + 11 * s, hoch - hk * 0.45);
        a.stroke();
        a.fillRect(cx0 - 26 * s, hoch - hk - 3 * s, 60 * s, 3 * s);
        a.fillRect(cx0 - 6 * s, hoch - hk - 9 * s, 12 * s, 6 * s);
        if (k === 1) {
          // Ein Kran mit hochgeklapptem Ausleger
          a.beginPath(); a.moveTo(cx0 + 10 * s, hoch - hk - 2 * s); a.lineTo(cx0 + 34 * s, hoch - hk - 40 * s); a.stroke();
        }
        mitte.blinker.push({ x: cx0, y: hoch - hk - 10 * s, ph: k * 2.1 });
      });
      // Lichtmasten mit ihren Lampen
      for (let m = 0; m < breit; m += 150 + hash01(m) * 60) {
        const mx = m + 40;
        const mh = 70 * s * 0.6;
        a.fillStyle = "#1a2036";
        a.fillRect(mx - 0.6, hoch - 4 * s - mh, 1.2, mh);
        b.fillStyle = "#ffcf7a";
        b.fillRect(mx - 3, hoch - 4 * s - mh - 1.5, 6, 2);
        const glanz = b.createRadialGradient(mx, hoch - 4 * s - mh, 0, mx, hoch - 4 * s - mh, 14);
        glanz.addColorStop(0, "rgba(255, 196, 110, 0.55)");
        glanz.addColorStop(1, "rgba(255, 196, 110, 0)");
        b.fillStyle = glanz;
        b.fillRect(mx - 14, hoch - 4 * s - mh - 14, 28, 28);
      }
      // Kleine Lichter auf den Containerbergen
      for (let k = 0; k < breit; k += 23) {
        if (hash01(k * 0.91) > 0.55) {
          b.fillStyle = "#ffe0a0";
          b.fillRect(k, hoch - 4 * s - (8 + hash01(k) * 24) * s, 1.2, 1.2);
        }
      }
    }
    bilder.fern = fern;
    bilder.mitte = mitte;
    hgStufen.clear();
  }

  function vorrendern() {
    const f = spriteF();
    bilder.kisten = FARBEN.map((farbe, nr) => kisteMalen(farbe, nr, f));
    bilder.kistenKopf = bilder.kisten.map(kopfueber);
    bilder.bruecke = brueckeMalen(f);
    bilder.schiffe.clear();
    hintergrundMalen();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Himmel, Stadt, Wasser
  // ---------------------------------------------------------------------------
  // Die Himmelsfarben ändern sich nur langsam – gerechnet wird nur, wenn sie
  // sich sichtbar geändert haben.
  let farbenStand = { t: -1, farben: null, bein: "" };
  function himmelJetzt() {
    const t = Math.round(state.himmel * 200) / 200;
    if (t !== farbenStand.t) {
      const farben = himmelFarben(t);
      farbenStand = { t, farben, bein: misch("#b07a16", farben.dunst, 0.42), beinDunkel: misch("#7a5410", farben.dunst, 0.42) };
    }
    return farbenStand.farben;
  }

  /*
   * Der Hintergrund – Himmel, Abendglühen, Stadt und Hafen mit ihren
   * Lichtern, das Wasser und darin die Lichter vom anderen Ufer – ist ein
   * einziges Bild je Stufe der Nacht (NACHT_STUFEN). Gezeichnet werden je
   * Bild die zwei Stufen, zwischen denen die Nacht gerade steht, die obere
   * so deckend, wie die Nacht schon weiter ist: So wird es weich dunkler,
   * und das Gerät stempelt zwei Bilder statt dutzender Verläufe.
   */
  const NACHT_STUFEN = 16;
  const hgStufen = new Map();

  function hgMalen(stufe) {
    const d = view.dpr;
    const breit = view.cssW + RAND_PX * 2;
    const hoch = view.cssH;
    const c = leinwand(breit * d, hoch * d);
    const cx = c.getContext("2d", { alpha: false });
    cx.scale(d, d);
    const nacht = stufe / NACHT_STUFEN;
    const fb = himmelFarben(nacht);
    const horizont = bildY(UFER_Y);
    // Himmel
    const v = cx.createLinearGradient(0, 0, 0, horizont);
    v.addColorStop(0, fb.oben);
    v.addColorStop(0.55, fb.mitte);
    v.addColorStop(1, fb.unten);
    cx.fillStyle = v;
    cx.fillRect(0, 0, breit, horizont + 1);
    // Das letzte Glühen über dem Horizont, links, wo die Sonne unterging
    if (nacht < 0.95) {
      const r = Math.max(view.cssW, horizont) * 0.8;
      const glut = cx.createRadialGradient(breit * 0.25, horizont, 0, breit * 0.25, horizont, r);
      glut.addColorStop(0, `rgba(255, 170, 112, ${0.45 * (1 - nacht)})`);
      glut.addColorStop(1, "rgba(255, 170, 112, 0)");
      cx.fillStyle = glut;
      cx.fillRect(0, 0, breit, horizont);
    }
    // Wolken, rosa angestrahlt, solange noch Licht ist
    const wb = clamp(view.s * 130, 110, 280);
    cx.globalAlpha = 0.08 + 0.3 * (1 - nacht);
    for (let i = 0; i < 3; i += 1) {
      const wo = WOLKEN[i];
      const wbreit = wb * wo.gross;
      cx.drawImage(bilder.wolke, wo.x * (breit - wbreit), wo.y * horizont * 0.8, wbreit, wbreit * 0.375);
    }
    cx.globalAlpha = 1;
    // Stadt, Dunst, Hafen – und ihre Lichter, je dunkler, desto heller
    const fern = bilder.fern;
    const mitte = bilder.mitte;
    const fernUnten = horizont - 3 * view.s;
    cx.drawImage(fern.bild, 0, fernUnten - fern.hoch, fern.breit, fern.hoch);
    cx.globalCompositeOperation = "lighter";
    cx.globalAlpha = 0.35 + 0.65 * nacht;
    cx.drawImage(fern.licht, 0, fernUnten - fern.hoch, fern.breit, fern.hoch);
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = "source-over";
    const dunst = cx.createLinearGradient(0, fernUnten - fern.hoch, 0, horizont);
    dunst.addColorStop(0, rgba(fb.dunst, 0));
    dunst.addColorStop(1, rgba(fb.dunst, 0.38 * (1 - nacht * 0.5)));
    cx.fillStyle = dunst;
    cx.fillRect(0, fernUnten - fern.hoch, breit, horizont - fernUnten + fern.hoch);
    cx.drawImage(mitte.bild, 0, horizont - mitte.hoch, mitte.breit, mitte.hoch);
    cx.globalCompositeOperation = "lighter";
    cx.globalAlpha = 0.45 + 0.55 * nacht;
    cx.drawImage(mitte.licht, 0, horizont - mitte.hoch, mitte.breit, mitte.hoch);
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = "source-over";
    // Wasser
    const w = cx.createLinearGradient(0, horizont, 0, hoch);
    w.addColorStop(0, fb.wasserOben);
    w.addColorStop(1, fb.wasserUnten);
    cx.fillStyle = w;
    cx.fillRect(0, horizont, breit, hoch - horizont);
    // Die Lichter vom anderen Ufer, kopfüber und gestaucht
    cx.save();
    cx.globalCompositeOperation = "lighter";
    cx.globalAlpha = 0.16 + 0.3 * nacht;
    cx.translate(0, horizont);
    cx.scale(1, -0.5);
    cx.drawImage(mitte.licht, 0, -mitte.hoch, mitte.breit, mitte.hoch);
    cx.restore();
    return c;
  }

  function hgStufe(stufe) {
    let c = hgStufen.get(stufe);
    if (!c) {
      c = hgMalen(stufe);
      hgStufen.set(stufe, c);
      // Mehr als zwei Stufen (die alte und die neue) braucht es nie zugleich.
      if (hgStufen.size > 2) hgStufen.delete(hgStufen.keys().next().value);
    }
    return c;
  }

  // Steht die Nacht eine Stufe weiter, blendet das neue Bild in einer halben
  // Sekunde über das alte – nur dann sind es zwei Bilder.
  const hg = { stufe: -1, von: -1, mix: 1 };

  function zeichneHintergrund(dt) {
    const ziel = Math.round(clamp(state.himmel, 0, 1) * NACHT_STUFEN);
    if (hg.stufe < 0 || !hgStufen.has(hg.stufe)) { hg.stufe = ziel; hg.mix = 1; }
    if (ziel !== hg.stufe) {
      hg.von = hg.stufe;
      hg.stufe = ziel;
      hg.mix = 0;
    }
    hg.mix = Math.min(1, hg.mix + dt / 0.5);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    const x = Math.round((-RAND_PX - clamp(state.camX * view.s * 0.25, -RAND_PX, RAND_PX)) * view.dpr);
    if (hg.mix < 1 && hgStufen.has(hg.von)) {
      g.drawImage(hgStufen.get(hg.von), x, 0);
      g.globalAlpha = hg.mix;
    }
    g.drawImage(hgStufe(hg.stufe), x, 0);
    g.globalAlpha = 1;
  }

  // Was sich am Himmel bewegt: Sterne funkeln, der Mond steigt, Wolken
  // ziehen, auf Türmen und Kränen blinken die Warnlampen.
  function zeichneHimmel() {
    bildTransform();
    const horizont = bildY(UFER_Y);
    const nacht = state.himmel;
    const sterne = sanft(0.04, 0.7, nacht);
    if (sterne > 0.01) {
      g.fillStyle = "#ffffff";
      const n = Math.min(STERNE.length, Math.round(56 * clamp(view.cssW / Math.max(1, horizont), 0.8, 2.3)));
      const bis = Math.max(20, horizont - bilder.fern.hoch);
      for (let i = 0; i < n; i += 1) {
        const st = STERNE[i];
        const funkeln = Math.sin(state.zeit * st.v + st.ph);
        g.globalAlpha = sterne * (0.4 + 0.6 * funkeln * funkeln) * (1 - st.y * 0.6);
        g.fillRect(st.x * view.cssW, st.y * bis, st.r, st.r);
      }
      g.globalAlpha = 1;
    }
    // Der Mond steigt, je dunkler es wird
    const mr = clamp(view.s * 10, 8, 24);
    const mx = view.cssW * 0.8;
    const my = Math.max(mr * 2, horizont * (0.6 - 0.38 * nacht));
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.25 + 0.45 * nacht;
    g.drawImage(bilder.glut.mond, mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#f5f0db";
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(190, 180, 150, 0.28)";
    g.beginPath();
    g.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.24, 0, Math.PI * 2);
    g.arc(mx + mr * 0.32, my + mr * 0.28, mr * 0.16, 0, Math.PI * 2);
    g.fill();
    // Warnlampen
    const x0 = -RAND_PX - clamp(state.camX * view.s * 0.25, -RAND_PX, RAND_PX);
    const r = clamp(view.s * 5, 4, 10);
    g.globalCompositeOperation = "lighter";
    [[bilder.fern, horizont - 3 * view.s], [bilder.mitte, horizont]].forEach(([e, u]) => {
      e.blinker.forEach((b) => {
        const an = Math.sin(state.zeit * 2.4 + b.ph);
        if (an < 0.2) return;
        g.globalAlpha = an;
        g.drawImage(bilder.glut.rot, x0 + b.x - r, u - e.hoch + b.y - r, r * 2, r * 2);
      });
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Ein Lichtstreifen auf dem Wasser unter einer Lampe: kurze Striche, die
  // nach unten breiter und blasser werden und im Takt der Wellen zittern.
  function streifen(sx, glut, alpha, breite, lang) {
    if (alpha <= 0.01) return;
    const oben = bildY(0);
    for (let i = 0; i < 9; i += 1) {
      const k = i / 9;
      const w = breite * (0.55 + 0.45 * Math.sin(state.zeit * 2.6 + i * 1.9)) * (1 + k * 1.4);
      g.globalAlpha = alpha * (1 - k);
      g.drawImage(glut, sx - w / 2 + Math.sin(state.zeit * 1.7 + i) * 2, oben + 2 + k * lang, w, 3 + k * 4);
    }
  }

  // Mond und Lichtkegel spiegeln sich als Streifen im Wasser.
  function zeichneWasser() {
    bildTransform();
    const nacht = state.himmel;
    const tief = view.cssH - bildY(UFER_Y);
    g.globalCompositeOperation = "lighter";
    const mr = clamp(view.s * 10, 8, 24);
    streifen(view.cssW * 0.8, bilder.glut.mond, 0.12 + 0.3 * nacht, mr * 3, Math.min(90, tief));
    streifen(bildX(state.katze), bilder.glut.warm, 0.18 + 0.32 * nacht, view.s * 40, Math.min(120, tief));
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Die Wellenlinien über allem, was sich spiegelt: helle und dunkle Striche,
  // die zum Betrachter hin weiter auseinanderliegen und langsam nach vorn
  // wandern.
  function zeichneWellenlinien() {
    bildTransform();
    const oben = bildY(UFER_Y);
    const hoehe = view.cssH - oben;
    if (hoehe <= 2) return;
    const n = 24;
    const lauf = state.zeit * 0.3;
    const ganz = Math.floor(lauf);
    const rest = lauf - ganz;
    for (let i = 0; i < n; i += 1) {
      const k = (i + rest) / n;
      const y = oben + hoehe * k * k;
      const dick = 0.6 + k * 2.4;
      const hell = (i + ganz) % 2 === 0;
      g.fillStyle = hell ? "#a8c0f0" : "#020814";
      g.globalAlpha = hell ? 0.05 + 0.07 * k : 0.16 + 0.2 * k;
      for (let j = 0; j < 4; j += 1) {
        const h = hash01((i - ganz) * 7.7 + j * 3.1);
        const len = view.cssW * (0.12 + h * 0.3);
        const wander = ((h * 1.7 + state.zeit * (0.006 + h * 0.012) * (j % 2 ? 1 : -1)) % 1 + 1) % 1;
        g.fillRect(wander * (view.cssW + len) - len, y, len, dick);
      }
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen: Kran, Schiffe, Container
  // ---------------------------------------------------------------------------
  // Die Kranbeine stehen hinten am Becken – das Schiff fährt vor ihnen durch.
  // Auf schmalen Bildern liegen sie ausserhalb.
  function zeichneBeine() {
    if (view.w / 2 + Math.abs(state.camX) < BEIN_X - 40) return;
    ort(0, 0);
    [-1, 1].forEach((seite) => {
      const x0 = seite * BEIN_X;
      g.fillStyle = farbenStand.bein;
      [-1, 1].forEach((innen) => {
        const xo = x0 + innen * 12;
        const xu = x0 + innen * 26;
        g.beginPath();
        g.moveTo(xo - 3.5, -BRUECKE_U);
        g.lineTo(xo + 3.5, -BRUECKE_U);
        g.lineTo(xu + 3.5, -UFER_Y);
        g.lineTo(xu - 3.5, -UFER_Y);
        g.closePath();
        g.fill();
      });
      g.fillStyle = farbenStand.beinDunkel;
      g.fillRect(x0 - 24, -170, 48, 6);
      g.fillRect(x0 - 18, -258, 36, 5);
      g.strokeStyle = farbenStand.beinDunkel;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x0 - 22, -164); g.lineTo(x0 + 16, -253);
      g.moveTo(x0 + 22, -164); g.lineTo(x0 - 16, -253);
      g.moveTo(x0 - 25, -24); g.lineTo(x0 + 23, -160);
      g.moveTo(x0 + 25, -24); g.lineTo(x0 - 23, -160);
      g.stroke();
    });
    // Die Lampen an den Beinen
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.5 + 0.5 * state.himmel;
    [-1, 1].forEach((seite) => {
      const x0 = seite * BEIN_X;
      g.drawImage(bilder.glut.warm, x0 - 14, 160, 28, 28);
    });
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Ein Container, mit seiner Unterkante im Ursprung. Stauchen beim Aufprall,
  // Strecken im Fall, Leuchten nach einem genauen Treffer.
  function kistenBild(farbe, stauch, streck, glanz) {
    const sx = 1 + stauch * 0.07 - streck * 0.04;
    const sy = 1 - stauch * 0.14 + streck * 0.08;
    if (sx !== 1 || sy !== 1) g.scale(sx, sy);
    g.globalAlpha = deck;
    g.drawImage(bilder.kisten[farbe], -KISTE_W / 2, -KISTE_H, KISTE_W, KISTE_H);
    if (nachtTon) {
      g.fillStyle = nachtTon;
      g.fillRect(-KISTE_W / 2, -KISTE_H, KISTE_W, KISTE_H);
    }
    if (glanz > 0.01) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = deck * glanz;
      g.fillStyle = "rgba(255, 236, 190, 0.32)";
      g.fillRect(-KISTE_W / 2, -KISTE_H, KISTE_W, KISTE_H);
      g.drawImage(bilder.glut.warm, -KISTE_W, -KISTE_H * 2.6, KISTE_W * 2, KISTE_H * 4);
      g.globalAlpha = deck;
      g.globalCompositeOperation = "source-over";
    }
  }
  // Wie deckend gezeichnet wird: 1, im Spiegelbild auf dem Wasser weniger.
  let deck = 1;
  // Wie dunkel die Nacht die Dinge im Vordergrund macht (je Bild gesetzt).
  let nachtTon = "";
  let nachtAlpha = 0;

  // Ein vorgemaltes Bild Bildpunkt für Bildpunkt hinstempeln: ohne Drehen,
  // ohne Strecken, auf ganze Bildpunkte gerundet – das Schnellste, was eine
  // Leinwand kann. links und oben in Welteinheiten.
  function stempel(bild, links, oben) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bild, Math.round(view.ox + links * view.f), Math.round(view.oy - oben * view.f));
  }

  // Das Spiegelbild im Wasser: das kopfüber gemalte Bild, mit der Oberkante
  // dort, wo das Ding unten aufhört – nur eben unter der Wasserlinie.
  function stempelSpiegel(kopf, links, unten) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(kopf, Math.round(view.ox + links * view.f), Math.round(view.oy + unten * view.f));
  }

  /*
   * Der Stapel auf einem Schiff. Das Rollen des Schiffs (und das Nachschwanken
   * nach einem Aufprall) schiebt jeden Container um so mehr zur Seite, je
   * höher er steht – gestempelt wird trotzdem gerade, das ist schneller als
   * jedes Drehen und bei so kleinen Winkeln nicht zu unterscheiden. Nur wer
   * gerade aufsetzt (Stauchen) oder auf der Kante kippelt, wird gedreht.
   */
  function stapelZeichnen(stapel, x, y0, roll, aktiv, spiegel) {
    const wob = aktiv && !ruhig() ? state.wackel : 0;
    const neig = Math.sin(roll) - wob * 0.6;
    for (let i = 0; i < stapel.length; i += 1) {
      const k = stapel[i];
      const v = LUKE_Y + i * KISTE_H;
      let u = k.off;
      if (k.rutsch > 0) u += (k.vonOff - k.off) * k.rutsch * k.rutsch;
      const xm = x + u - v * neig;
      const yb = y0 + v;
      if (spiegel) {
        stempelSpiegel(bilder.kistenKopf[k.farbe], xm - KISTE_W / 2, yb);
        continue;
      }
      if (k.stauch > 0 || k.kippW) {
        ort(xm, yb);
        if (k.kippW) {
          const unten = i > 0 ? stapel[i - 1].off : 0;
          const kante = unten - u + k.kippSeite * (KISTE_W / 2);
          g.translate(kante, 0);
          g.rotate(k.kippSeite * k.kippW);
          g.translate(-kante, 0);
        }
        kistenBild(k.farbe, k.stauch, 0, k.glanz);
        continue;
      }
      const bild = bilder.kisten[k.farbe];
      stempel(bild, xm - KISTE_W / 2, yb + KISTE_H);
      if (nachtTon || k.glanz > 0.01) {
        const px = Math.round(view.ox + (xm - KISTE_W / 2) * view.f);
        const py = Math.round(view.oy - (yb + KISTE_H) * view.f);
        if (nachtTon) {
          g.fillStyle = nachtTon;
          g.fillRect(px, py, bild.width, bild.height);
        }
        if (k.glanz > 0.01) {
          g.globalCompositeOperation = "lighter";
          g.globalAlpha = k.glanz;
          g.fillStyle = "rgba(255, 236, 190, 0.32)";
          g.fillRect(px, py, bild.width, bild.height);
          g.drawImage(bilder.glut.warm, px - bild.width / 2, py - bild.height * 1.6, bild.width * 2, bild.height * 4);
          g.globalAlpha = 1;
          g.globalCompositeOperation = "source-over";
        }
      }
    }
  }

  // Die Lichter eines Schiffs: Topplicht, Seitenlicht (Backbord, rot – das
  // Schiff zeigt mit dem Bug nach links), Hecklicht, Decksstrahler.
  const SCHIFF_LICHTER = [
    { x: -84, y: -65, r: 7, glut: "weiss" },
    { x: 103, y: -74, r: 6, glut: "rot" },
    { x: 101, y: -23, r: 5, glut: "weiss" },
    { x: 49, y: -43, r: 16, glut: "warm" },
    { x: 61.8, y: -108, r: 5, glut: "rot", blink: true },
  ];

  /*
   * Ein Schiff mit seinem Stapel – oder (spiegel) sein Spiegelbild. Nur was
   * über dem Wasser liegt, wird gezeichnet: Von dem vorgemalten Bild werden
   * so viele Zeilen gestempelt, wie über der Wasserlinie stehen. Ein volles
   * Schiff liegt tiefer, dann sind es weniger.
   */
  function zeichneSchiff(sch, stapel, x, roll, aktiv, spiegel = false) {
    const plan = sch.plan;
    const bild = schiffBild(plan);
    const sink = (SINK * stapel.length) / plan.platz + (aktiv ? state.bob : 0);
    const nacht = state.himmel;
    const f = view.f;
    const breite = bild.bild.width;
    const ueber = Math.max(1, Math.min(bild.bild.height, Math.round((-SCHIFF_OBEN - sink) * f)));
    const dx = Math.round(view.ox + (x + SCHIFF_LINKS) * f);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = deck;
    if (spiegel) {
      g.drawImage(bild.kopf, 0, bild.kopf.height - ueber, breite, ueber, dx, Math.round(view.oy), breite, ueber);
    } else {
      g.drawImage(bild.bild, 0, 0, breite, ueber, dx, Math.round(view.oy) - ueber, breite, ueber);
    }
    // Die Ecken der Luke leuchten, solange dort noch nichts steht.
    if (aktiv && !stapel.length && !spiegel) {
      ort(x, -sink);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.55 + 0.35 * Math.sin(state.zeit * 5);
      g.strokeStyle = "#ffd23f";
      g.lineWidth = 1.4;
      g.beginPath();
      [-1, 1].forEach((s) => {
        g.moveTo(s * 24, -LUKE_Y - 7);
        g.lineTo(s * 24, -LUKE_Y);
        g.lineTo(s * 17, -LUKE_Y);
      });
      g.stroke();
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = deck;
    stapelZeichnen(stapel, x, -sink, roll, aktiv, spiegel);
    // Die Lichter (auch im Spiegel)
    view.spiegel = spiegel;
    ort(x, -sink);
    g.globalCompositeOperation = "lighter";
    SCHIFF_LICHTER.forEach((l) => {
      if (l.blink && Math.sin(state.zeit * 3.1) < 0.3) return;
      g.globalAlpha = deck * ((l.glut === "warm" ? 0.25 : 0.55) + 0.45 * nacht);
      const r = l.r;
      g.drawImage(bilder.glut[l.glut], l.x - r, l.y - r, r * 2, r * 2);
    });
    view.spiegel = false;
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Bugwelle und Kielwasser: weisse Schaumflecken an der Wasserlinie, je
  // schneller das Schiff, desto mehr.
  function zeichneSchaum(x, v) {
    const k = clamp(Math.abs(v) / 120, 0.08, 1);
    ort(0, 0);
    g.fillStyle = "#e8f1ff";
    for (let i = 0; i < 7; i += 1) {
      const h = hash01(i * 4.3);
      const vorn = v < 0 ? -1 : 1;
      const px = x + vorn * (98 - i * 3) + Math.sin(state.zeit * 3 + i) * 2;
      g.globalAlpha = k * (0.5 - i * 0.05);
      g.beginPath();
      g.ellipse(px, 0.3, 4 + h * 6 * k + i, 1 + k, 0, 0, Math.PI * 2);
      g.fill();
      const hx = x - vorn * (100 + i * 6 * k * 3);
      g.globalAlpha = k * (0.35 - i * 0.04);
      g.beginPath();
      g.ellipse(hx, 0.2, 6 + i * 3 * k, 0.9, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Die Zielmarken der Gegner: Liegt ihre Zahl auf diesem Schiff, leuchtet
  // in der Höhe, die man dafür erreichen muss, ein Strich neben dem Stapel.
  function zeichneZielmarken() {
    // Wem gerade zugeschaut wird, dessen Lauf steht ja im Bild.
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => !ziel.ziel && ziel.punkte > 0);
    if (!ziele.length || !state.schiff) return;
    const vorher = state.punkte - state.stapel.length;
    const platz = state.schiff.plan.platz;
    const sch = state.schiff;
    const x = schiffX(sch, state.uhr);
    const roll = schiffRoll(sch, state.uhr);
    const sink = (SINK * state.stapel.length) / platz + state.bob;
    const sichtbar = ziele.filter((ziel) => ziel.punkte - vorher >= 1 && ziel.punkte - vorher <= platz);
    if (!sichtbar.length) return;
    sichtbar.forEach((ziel) => {
      const v = LUKE_Y + (ziel.punkte - vorher) * KISTE_H;
      const geschafft = state.punkte >= ziel.punkte;
      ort(x, -sink, roll);
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = geschafft ? 0.2 : 0.5 + 0.2 * Math.sin(state.zeit * 4);
      g.drawImage(bilder.glut.weiss, -60, -v - 5, 120, 10);
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = geschafft ? 0.4 : 1;
      g.strokeStyle = ziel.farbe || "#ffd23f";
      g.lineWidth = 1.6;
      g.setLineDash([5, 3.5]);
      g.beginPath();
      g.moveTo(-50, -v);
      g.lineTo(50, -v);
      g.stroke();
      g.setLineDash([]);
    });
    bildTransform();
    const gross = Math.round(clamp(view.s * 11, 11, 15));
    g.font = `800 ${gross}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "bottom";
    sichtbar.forEach((ziel, i) => {
      const v = LUKE_Y + (ziel.punkte - vorher) * KISTE_H - sink;
      const text = ziel.art === "eigen" ? `Bestmarke ${ziel.punkte}` : `${ziel.name} ${ziel.punkte}`;
      const sx = bildX(x + 52);
      const sy = bildY(v) - 2 - (sichtbar[i - 1] && sichtbar[i - 1].punkte === ziel.punkte ? gross + 2 : 0);
      g.globalAlpha = state.punkte >= ziel.punkte ? 0.45 : 1;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(8, 12, 30, 0.7)";
      g.strokeText(text, sx, sy);
      g.fillStyle = ziel.farbe || "#ffd23f";
      g.fillText(text, sx, sy);
    });
    g.globalAlpha = 1;
  }

  // Der Schatten des fallenden Containers auf dem, worauf er gleich landet.
  function zeichneSchatten() {
    const k = state.kiste;
    if (!k?.fallend || !k.f || !state.schiff) return;
    const oben = spitzeY();
    const nah = clamp(1 - (k.f.y - oben) / FALL_H, 0, 1);
    ort(0, 0);
    g.fillStyle = "#000000";
    g.globalAlpha = 0.12 + 0.3 * nah;
    g.beginPath();
    g.ellipse(k.f.x, -oben - 0.6, KISTE_W * (0.32 + 0.2 * nah), 1.6 + nah, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  // Der Lichtkegel unter der Laufkatze und sein Fleck auf dem Wasser.
  function zeichneKegel() {
    const nacht = state.himmel;
    const a = 0.05 + 0.15 * nacht;
    const x = state.katze + 9;
    ort(0, 0);
    const v = g.createLinearGradient(0, -KATZE_Y, 0, 0);
    v.addColorStop(0, `rgba(255, 232, 180, ${a})`);
    v.addColorStop(1, "rgba(255, 232, 180, 0)");
    g.globalCompositeOperation = "lighter";
    g.fillStyle = v;
    g.beginPath();
    g.moveTo(x - 4, -KATZE_Y + 2);
    g.lineTo(x + 4, -KATZE_Y + 2);
    g.lineTo(x + 80, 0);
    g.lineTo(x - 80, 0);
    g.closePath();
    g.fill();
    g.globalAlpha = 0.18 + 0.3 * nacht;
    g.drawImage(bilder.glut.warm, x - 95, -10, 190, 22);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Container, die ins Wasser gehen: kippen, fallen, platschen, sinken.
  function zeichneWracks() {
    state.wracks.forEach((w) => {
      ort(w.x, w.y, w.ang);
      deck = w.alpha;
      g.translate(0, KISTE_H / 2);
      kistenBild(w.farbe, 0, 0, 0);
      deck = 1;
    });
    g.globalAlpha = 1;
  }

  // Der Container am Seil oder im Fall.
  function zeichneKiste() {
    const k = state.kiste;
    if (!k) return;
    const t = state.uhr - k.spawn;
    if (t < 0 && !k.fallend) return;
    let x;
    let y;
    let neig;
    let streck = 0;
    if (k.fallend && k.f) {
      x = k.f.x;
      y = k.f.y;
      neig = k.f.neig;
      streck = ruhig() ? 0 : clamp(-k.f.vy / 520, 0, 1);
    } else {
      x = kisteX(k, state.uhr);
      y = kisteY(k, state.uhr);
      neig = kisteNeig(k, state.uhr);
    }
    ort(x, y, neig);
    deck = k.fallend ? 1 : clamp(t / (EINZUG * 0.45), 0, 1);
    kistenBild(k.plan.farbe, 0, streck, 0);
    deck = 1;
    g.globalAlpha = 1;
  }

  // Seile, Spreader, Laufkatze und Brücke. Der Spreader hält den Container
  // oder schnellt nach dem Loslassen hoch und hängt dann leer unter der Katze.
  function zeichneKran() {
    const kx = state.katze;
    const h = state.haken;
    const nacht = state.himmel;
    ort(0, 0);
    g.lineWidth = 0.9;
    g.strokeStyle = "#5d6570";
    g.beginPath();
    [-1, 1].forEach((s) => {
      g.moveTo(kx + s * 7 + 0.6, -KATZE_Y);
      g.lineTo(h.x + s * 9 + 0.6, -(h.y + SPREADER_H + 3));
    });
    g.stroke();
    g.lineWidth = 0.6;
    g.strokeStyle = "#d4dbe4";
    g.beginPath();
    [-1, 1].forEach((s) => {
      g.moveTo(kx + s * 7, -KATZE_Y);
      g.lineTo(h.x + s * 9, -(h.y + SPREADER_H + 3));
    });
    g.stroke();
    // Spreader mit Kopfblock und den Lämpchen der Verriegelung
    ort(h.x, h.y, h.neig);
    g.fillStyle = "#f2b31c";
    g.fillRect(-25, -SPREADER_H, 50, SPREADER_H);
    g.fillStyle = "#ffd96a";
    g.fillRect(-25, -SPREADER_H, 50, 0.9);
    g.fillStyle = "#a8720e";
    g.fillRect(-25, -1.2, 50, 1.2);
    g.fillStyle = "#3a3f48";
    [-17, -6, 6, 17].forEach((sx) => g.fillRect(sx - 2.2, -3.8, 4.4, 1.6));
    g.fillStyle = "#2c3038";
    g.fillRect(-7, -SPREADER_H - 3.5, 14, 3.5);
    g.fillStyle = "#8a929c";
    g.beginPath();
    g.arc(-4, -SPREADER_H - 3.5, 1.8, 0, Math.PI * 2);
    g.arc(4, -SPREADER_H - 3.5, 1.8, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.9;
    const lampe = h.zu ? bilder.glut.gruen : bilder.glut.rot;
    g.drawImage(lampe, -28, -6.5, 7, 7);
    g.drawImage(lampe, 21, -6.5, 7, 7);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // Die Laufkatze
    ort(kx, BRUECKE_U);
    g.fillStyle = "#2b2f36";
    g.beginPath();
    g.arc(-15, 1.6, 2.6, 0, Math.PI * 2);
    g.arc(15, 1.6, 2.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#4b5462";
    g.fillRect(-22, 3, 44, 13);
    g.fillStyle = "#6b7585";
    g.fillRect(-22, 3, 44, 1.6);
    g.fillStyle = "#f2b31c";
    g.fillRect(-22, 13, 44, 2.4);
    g.fillStyle = "#1d2027";
    for (let sx = -21; sx < 22; sx += 4) g.fillRect(sx, 13, 1.6, 2.4);
    // Die Kabine des Kranführers, mit Licht
    g.fillStyle = "#e7ebf0";
    g.fillRect(-37, 4, 14, 14);
    g.fillStyle = "#3a414c";
    g.fillRect(-37, 17, 14, 1.4);
    g.fillStyle = "#1a2638";
    g.fillRect(-35.5, 6.5, 11, 7);
    g.fillStyle = "#ffcf7a";
    g.globalAlpha = 0.45 + 0.5 * nacht;
    g.fillRect(-35.5, 6.5, 11, 7);
    g.globalAlpha = 1;
    g.fillStyle = "#20242c";
    g.beginPath();
    g.arc(-31, 10.4, 1.5, 0, Math.PI * 2);
    g.fill();
    g.fillRect(-32.6, 11.6, 3.2, 2);
    // Seilrollen und der Scheinwerfer
    g.fillStyle = "#8a929c";
    g.beginPath();
    g.arc(-7, 17, 1.9, 0, Math.PI * 2);
    g.arc(7, 17, 1.9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2b2f36";
    g.fillRect(6, 15.4, 6, 3);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.6 + 0.4 * nacht;
    g.drawImage(bilder.glut.weiss, 9 - 7, 18 - 6, 14, 12);
    g.drawImage(bilder.glut.warm, -30 - 12, 10 - 10, 24, 20);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";

    // Die Brücke
    // Die Brücke – nachts von ihren eigenen Lampen angestrahlt
    const b = bilder.bruecke;
    stempel(b.bild, -b.breite / 2, BRUECKE_U + 38.6);
    ort(0, 0);
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.35 + 0.55 * nacht;
    for (let lx = -240; lx <= 240; lx += 80) g.drawImage(bilder.glut.warm, lx - 11, -BRUECKE_U - 9, 22, 18);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Funken, Staub, Spritzer, Rauch – und die Ringe auf dem Wasser.
  function zeichneTeile() {
    ort(0, 0);
    for (let i = 0; i < state.teile.length; i += 1) {
      const t = state.teile[i];
      if (t.art === "funke") continue;
      const k = clamp(t.leben / t.max, 0, 1);
      g.fillStyle = t.farbe;
      if (t.art === "konfetti") {
        g.globalAlpha = Math.min(1, k * 2);
        const c = Math.cos(t.dreh) * 2.2;
        g.fillRect(t.x - Math.abs(c) / 2, -t.y - 1.2, Math.abs(c) + 0.3, 2.4);
        continue;
      }
      if (t.art === "tropfen") {
        g.globalAlpha = k;
        g.fillRect(t.x - 0.6, -t.y - 0.9, 1.2, 1.8);
        continue;
      }
      const r = t.r * (t.art === "staub" ? 1.8 - k : t.art === "blase" ? 1 : 2.6 - 1.6 * k);
      g.globalAlpha = k * (t.art === "rauch" ? 0.32 : t.art === "dampf" ? 0.55 : t.art === "blase" ? 0.6 : 0.42);
      g.beginPath();
      g.arc(t.x, -t.y, Math.max(0.2, r), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // Ringe auf dem Wasser
    g.strokeStyle = "#dceaff";
    state.wellen.forEach((w) => {
      const k = clamp(w.leben / w.max, 0, 1);
      g.globalAlpha = k * 0.6;
      g.lineWidth = 0.8 + k;
      g.beginPath();
      g.ellipse(w.x, 0.2, w.r, w.r * 0.14, 0, 0, Math.PI * 2);
      g.stroke();
    });
    g.globalAlpha = 1;
    // Funken leuchten
    g.globalCompositeOperation = "lighter";
    for (let i = 0; i < state.teile.length; i += 1) {
      const t = state.teile[i];
      if (t.art !== "funke") continue;
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = k;
      const r = t.r * (0.5 + k);
      g.drawImage(bilder.glut[t.glut || "funke"], t.x - r, -t.y - r, r * 2, r * 2);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // Möwen: ein paar Striche, die mit den Flügeln schlagen.
  function zeichneMoewen() {
    ort(0, 0);
    g.strokeStyle = "#eef2f8";
    g.lineWidth = 1.1;
    g.lineCap = "round";
    state.moewen.forEach((m) => {
      const schlag = Math.sin(state.zeit * m.takt + m.ph);
      const fl = 2.8 * schlag;
      g.globalAlpha = 0.85 - 0.35 * state.himmel;
      g.beginPath();
      g.moveTo(m.x - 6 * m.r, -m.y + fl * m.r * 0.6);
      g.quadraticCurveTo(m.x - 3 * m.r, -m.y - (2 + fl) * m.r, m.x, -m.y);
      g.quadraticCurveTo(m.x + 3 * m.r, -m.y - (2 + fl) * m.r, m.x + 6 * m.r, -m.y + fl * m.r * 0.6);
      g.stroke();
    });
    g.globalAlpha = 1;
    g.lineCap = "butt";
  }

  // Nach einem Fehlwurf: wo der Container hätte stehen sollen.
  function zeichneFehler() {
    const fe = state.fehler;
    if (!fe || !state.schiff) return;
    const sch = state.schiff;
    const roll = schiffRoll(sch, state.uhr);
    const sink = (SINK * state.stapel.length) / sch.plan.platz;
    ort(schiffX(sch, state.uhr), -sink, roll);
    g.translate(spitzeOff(), -(LUKE_Y + state.stapel.length * KISTE_H));
    const a = clamp(fe.zeit / 0.3, 0, 1) * (0.6 + 0.4 * Math.sin(state.zeit * 9));
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = a * 0.5;
    g.drawImage(bilder.glut.gruen, -KISTE_W * 0.8, -KISTE_H * 1.6, KISTE_W * 1.6, KISTE_H * 2.2);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = a;
    g.strokeStyle = "#7dffa8";
    g.lineWidth = 1.2;
    g.setLineDash([3.5, 2.5]);
    g.strokeRect(-KISTE_W / 2, -KISTE_H, KISTE_W, KISTE_H);
    g.setLineDash([]);
    g.globalAlpha = 1;
  }

  // Die Schriften im Bild: "Perfekt!", "Knapp!", "Schiff voll!" – sie
  // springen auf, steigen und verblassen.
  function zeichneTexte() {
    if (!state.texte.length) return;
    bildTransform();
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    state.texte.forEach((t) => {
      if (t.warte > 0) return;
      const alter = t.max - t.leben;
      const pop = alter < 0.16 ? 0.4 + (alter / 0.16) * 0.85 : alter < 0.3 ? 1.25 - ((alter - 0.16) / 0.14) * 0.25 : 1;
      const groesse = Math.round(t.groesse * clamp(view.s, 0.85, 1.6));
      g.save();
      g.translate(clamp(bildX(t.x), groesse * 3, view.cssW - groesse * 3), bildY(t.y + alter * t.steig));
      g.scale(pop, pop);
      g.globalAlpha = clamp(t.leben / 0.35, 0, 1);
      g.font = `900 ${groesse}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, groesse * 0.2);
      g.strokeStyle = "rgba(8, 12, 30, 0.78)";
      g.strokeText(t.text, 0, 0);
      g.fillStyle = t.farbe;
      g.fillText(t.text, 0, 0);
      g.restore();
    });
    g.globalAlpha = 1;
  }

  // Oben links, unter den Knöpfen: welches Schiff, seine Plätze, der Wind
  // und die Zielmarken der Gegner.
  function zeichneAnzeige() {
    if (!state.schiff) return;
    bildTransform();
    g.translate(0, shell?.frei?.(canvas) || 0);
    const x0 = 12;
    let y = 10;
    // Ein dunkles Schild dahinter, damit es auch vor der gelben Brücke lesbar
    // bleibt.
    const ziele = (gegner?.gegner?.() || []).filter((ziel) => !ziel.ziel && ziel.punkte > 0).slice(-3);
    const zeilen = 2 + (state.schiff.plan.wind ? 1 : 0) + ziele.length;
    const breite = Math.max(92, state.schiff.plan.platz * 14 + 12);
    g.fillStyle = "rgba(8, 12, 30, 0.38)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x0 - 7, y - 5, breite, zeilen * 15 + 10, 8);
    else g.rect(x0 - 7, y - 5, breite, zeilen * 15 + 10);
    g.fill();
    g.textAlign = "left";
    g.textBaseline = "top";
    g.lineJoin = "round";
    const schreibe = (text, x, yy, farbe, groesse = 12) => {
      g.font = `800 ${groesse}px system-ui, sans-serif`;
      g.lineWidth = 3;
      g.strokeStyle = "rgba(8, 12, 30, 0.7)";
      g.strokeText(text, x, yy);
      g.fillStyle = farbe;
      g.fillText(text, x, yy);
    };
    schreibe(`Schiff ${state.schiffNr + 1}`, x0, y, "#ffffff");
    y += 17;
    const platz = state.schiff.plan.platz;
    for (let i = 0; i < platz; i += 1) {
      const k = state.stapel[i];
      const x = x0 + i * 14;
      if (k) {
        g.fillStyle = FARBEN[k.farbe].grund;
        g.fillRect(x, y, 12, 6);
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.fillRect(x, y + 4.5, 12, 1.5);
      } else {
        g.globalAlpha = i === state.stapel.length ? 0.55 + 0.4 * Math.sin(state.zeit * 6) : 0.5;
        g.strokeStyle = "#ffffff";
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y + 0.5, 11, 5);
        g.globalAlpha = 1;
      }
    }
    y += 12;
    const wind = state.schiff.plan.wind;
    if (wind) {
      const st = Math.min(3, Math.ceil(Math.abs(wind) / 0.045));
      const pfeil = wind < 0 ? "‹" : "›";
      schreibe(`Wind ${pfeil.repeat(st)}`, x0, y, "#bfe3ff");
      y += 17;
    }
    ziele.forEach((ziel) => {
      const text = ziel.art === "eigen" ? `Bestmarke: ${ziel.punkte}` : ziel.art === "erster" ? `Platz 1: ${ziel.punkte}` : `${ziel.name}: ${ziel.punkte}`;
      g.globalAlpha = state.punkte > ziel.punkte ? 0.5 : 1;
      schreibe(state.punkte > ziel.punkte ? `✓ ${text}` : text, x0, y, ziel.farbe || "#ffd23f", 11);
      g.globalAlpha = 1;
      y += 15;
    });
  }

  function zeichnen(dt = 0) {
    if (!g || !view.cssW || !state.schiff) return;
    kamera();
    himmelJetzt();
    nachtAlpha = 0.42 * state.himmel;
    nachtTon = nachtAlpha > 0.01 ? `rgba(6, 10, 28, ${nachtAlpha.toFixed(3)})` : "";
    g.setTransform(1, 0, 0, 1, 0, 0);
    zeichneHintergrund(dt);
    zeichneHimmel();
    zeichneWasser();

    // Das Spiegelbild der Schiffe, dann die Wellen darüber
    deck = 0.2;
    state.abfahrt.forEach((a) => zeichneSchiff(a.schiff, a.stapel, abfahrtX(a, state.uhr), schiffRoll(a.schiff, state.uhr), false, true));
    zeichneSchiff(state.schiff, state.stapel, schiffX(state.schiff, state.uhr), schiffRoll(state.schiff, state.uhr), true, true);
    deck = 1;
    zeichneWellenlinien();

    zeichneBeine();
    state.abfahrt.forEach((a) => {
      const x = abfahrtX(a, state.uhr);
      zeichneSchiff(a.schiff, a.stapel, x, schiffRoll(a.schiff, state.uhr), false);
      zeichneSchaum(x, a.v0 - ABFAHRT_A * (state.uhr - a.t0));
    });
    const sx = schiffX(state.schiff, state.uhr);
    zeichneSchiff(state.schiff, state.stapel, sx, schiffRoll(state.schiff, state.uhr), true);
    zeichneSchaum(sx, schiffV(state.schiff, state.uhr));
    zeichneZielmarken();
    zeichneSchatten();
    zeichneKegel();
    zeichneWracks();
    zeichneKiste();
    zeichneKran();
    zeichneTeile();
    zeichneMoewen();
    zeichneFehler();
    zeichneTexte();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Zierde: Funken, Staub, Spritzer, Schriften
  // ---------------------------------------------------------------------------
  // Beim Zuschauen baut dieses Gerät nur nach – es klingt wie im Spiel, aber
  // es brummt nicht.
  const zuschauend = () => state.phase === "zuschauen";
  const brumm = (muster) => { if (!zuschauend()) kids()?.vibrate?.(muster); };
  const viele = (n) => (ruhig() ? Math.ceil(n * 0.35) : n);

  // Der Hafen im Hintergrund (klang.js), solange gestapelt wird – mit dem
  // Wind eines Schiffs ein wenig lauter. Er verstummt, sobald ein Container
  // danebengeht.
  let hafen = null;
  function hafenAn() {
    if (!hafen?.laeuft) hafen = klang()?.kulisse("kranhafen.ambient") || null;
    hafenStellen();
  }
  function hafenStellen() {
    if (!hafen?.laeuft) return;
    hafen.laut(0.75);
    hafen.setze(0.35 + 0.5 * clamp(Math.abs(state.schiff?.plan.wind || 0) / 0.13, 0, 1));
  }
  function hafenAus() {
    hafen?.stop();
    hafen = null;
  }
  // Ein Container prallt aufs Deck oder auf den Stapel – höchstens alle
  // 80 ms ein Schlag.
  let aufsetzenZuletzt = -1e9;
  // Ob der Container dieser Runde schon im Wasser ist: Hüpft er lange übers
  // Deck, kommt die Tafel zuerst – dann platscht es mit ihr.
  let platschte = false;
  function aufsetzen(laut) {
    const jetzt = performance.now();
    if (jetzt - aufsetzenZuletzt < 80) return;
    aufsetzenZuletzt = jetzt;
    klang()?.ton("kranhafen.aufsetzen", { laut });
  }

  function teil(t) {
    if (state.teile.length < TEILE_MAX) state.teile.push(t);
  }

  function funken(x, y, n, glut = "funke") {
    for (let i = 0; i < viele(n); i += 1) {
      const w = Math.PI * (0.1 + Math.random() * 0.8);
      const v = 60 + Math.random() * 150;
      teil({ art: "funke", x, y, vx: Math.cos(w) * v * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(w) * v, r: 2.4 + Math.random() * 2.6, leben: 0.4 + Math.random() * 0.3, max: 0.7, glut, farbe: "" });
    }
  }

  function staub(x, y, n, richtung = 0) {
    for (let i = 0; i < viele(n); i += 1) {
      teil({
        art: "staub", x: x + (Math.random() - 0.5) * 6, y: y + Math.random() * 2,
        vx: (richtung || (Math.random() < 0.5 ? -1 : 1)) * (12 + Math.random() * 36), vy: 4 + Math.random() * 14,
        r: 1.6 + Math.random() * 2.2, leben: 0.5 + Math.random() * 0.4, max: 0.9, farbe: "#c8bca8",
      });
    }
  }

  function spritzer(x, staerke) {
    for (let i = 0; i < viele(Math.round(26 * staerke)); i += 1) {
      const v = (90 + Math.random() * 180) * staerke;
      const w = Math.PI * (0.2 + Math.random() * 0.6);
      teil({ art: "tropfen", x: x + (Math.random() - 0.5) * 30, y: 1, vx: Math.cos(w) * v * 0.6, vy: Math.sin(w) * v, r: 1, leben: 0.9 + Math.random() * 0.5, max: 1.4, farbe: "#d6e8ff" });
    }
    for (let i = 0; i < viele(10); i += 1) {
      teil({ art: "dampf", x: x + (Math.random() - 0.5) * 34, y: 3 + Math.random() * 6, vx: (Math.random() - 0.5) * 30, vy: 10 + Math.random() * 18, r: 3 + Math.random() * 4, leben: 0.7 + Math.random() * 0.5, max: 1.2, farbe: "#eef5ff" });
    }
    state.wellen.push({ x, r: 6, v: 70 * staerke, leben: 1.3, max: 1.3 });
    state.wellen.push({ x, r: 2, v: 42 * staerke, leben: 1.6, max: 1.6 });
  }

  function schrift(text, x, y, farbe, groesse = 22, max = 1.1, steig = 16, warte = 0) {
    state.texte.push({ text, x, y, farbe, groesse, leben: max, max, steig, warte });
    if (state.texte.length > 6) state.texte.shift();
  }

  // ---------------------------------------------------------------------------
  // Schiffe und Container kommen
  // ---------------------------------------------------------------------------
  function neuesSchiff(nr, uhr) {
    const plan = state.plan.schiffe[Math.min(nr, state.plan.schiffe.length - 1)];
    return { nr, plan, spawn: uhr, einX: Math.max(640, view.w / 2 + 160) };
  }

  // Ein neuer Container für die Laufkatze, ab spawn. Die Katze gleitet aus
  // der Bahn des vorigen in ihre neue; der Container hängt FALL_H über dem
  // Stapel, das Seil ist entsprechend lang, und bei Wind hängt es schräg.
  function neueKiste(spawn, vorige) {
    const n = state.punkte;
    const plan = state.plan.kisten[Math.min(n, state.plan.kisten.length - 1)];
    const alt = vorige ? { plan: vorige.plan, spawn: vorige.spawn, von: vorige.von, alt: null } : null;
    const von = alt ? katzeBei(alt, spawn) : plan.kMitte + plan.kWeite * Math.sin(plan.kPhase);
    const hangY = spitzeY() + FALL_H;
    const seil = KATZE_Y - SPREADER_H - (hangY + KISTE_H);
    state.kiste = {
      n, plan, spawn, von, alt, hangY, seil,
      windVersatz: seil * Math.tan(state.schiff.plan.wind),
      fallend: false, f: null,
    };
  }

  // ---------------------------------------------------------------------------
  // Loslassen, landen, danebengehen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los). Die Uhr läuft dabei weiter,
  // wie sie lief: Das Pendel springt nicht. Wie weit sie schon war, geht im
  // ersten Zug mit, damit es beim Zuschauen ebenso pendelt.
  function losGehts() {
    if (state.phase !== "bereit") return;
    state.phase = "spiel";
    shell.setPhase("play");
    state.uhrVersatz = state.uhr;
    state.losMs = performance.now();
    gegner?.los();
    aufnahme?.los();
    meldeZug(0);
    hafenAn();
  }

  // Der Spreader öffnet sich und schnellt nach dem Loslassen hoch.
  function hakenLos(k, uhr) {
    const h = state.haken;
    h.x = kisteX(k, uhr);
    h.y = kisteY(k, uhr) + KISTE_H;
    h.vx = kisteV(k, uhr) * 0.6;
    h.vy = 170;
    h.neig = kisteNeig(k, uhr);
    h.zu = false;
    klang()?.ton("kranhafen.los", { laut: 0.8 });
  }

  function tap() {
    if (state.phase === "bereit") {
      if (shell.live) return;
      losGehts();
    }
    if (state.phase !== "spiel") return;
    const k = state.kiste;
    if (!k || k.fallend || state.uhr - k.spawn < EINZUG) return;
    const sch = state.schiff;
    k.fallend = true;
    k.f = loslassDaten(k, state.uhr);
    hakenLos(k, state.uhr);
    brumm(10);
    meldeZug(1, { xRel: k.f.x - schiffX(sch, state.uhr), vRel: k.f.vx - schiffV(sch, state.uhr) });
  }

  function druecken() {
    tap();
  }

  // Loslassen des Fingers bedeutet hier nichts – getippt ist getippt.
  function loslassen() {}

  // Der Container ist aufgeschlagen (nur beim Spielen; wer zuschaut, nimmt,
  // was der Zug sagt).
  function landen(k) {
    const e = ergebnis(k.f);
    if (e.daneben) {
      kisteDaneben({ d: e.ende, vRel: e.vRel, uhr: k.f.uhr }, false);
      meldeZug(2, e);
      state.phase = "ende";
      kids()?.vibrate?.([30, 50, 80]);
      stepTimer = window.setTimeout(finish, ENDE_MS);
      return;
    }
    const off = Math.round((spitzeOff() + e.ende) * 100) / 100;
    kisteLandet({ off, einschlag: e.d, combo: e.perfekt ? state.combo + 1 : 0, sofort: false, uhr: k.f.uhr });
    meldeZug(0);
  }

  /*
   * Ein Container steht – beim Spielen und beim Zuschauen derselbe Weg.
   * off: wo er auf dem Schiff steht (Mitte, gegenüber der Lukenmitte),
   * einschlag: wo er aufschlug, gegenüber dem darunter (von dort rutscht er).
   * sofort: ohne Zierde (beim Zuschauen etwas, das längst geschehen ist).
   */
  function kisteLandet({ off, einschlag, combo, sofort, uhr }) {
    const k = state.kiste;
    const plan = k ? k.plan : state.plan.kisten[Math.min(state.punkte, state.plan.kisten.length - 1)];
    const unten = spitzeOff();
    const ende = off - unten;
    const perfekt = Math.abs(ende) < 0.005;
    const knapp = KISTE_W / 2 - Math.abs(ende) < KNAPP;
    const neu = {
      off,
      farbe: plan.farbe,
      stauch: sofort ? 0 : 1,
      glanz: perfekt && !sofort ? 1 : 0,
      rutsch: sofort ? 0 : 1,
      vonOff: unten + clamp(einschlag, -KISTE_W, KISTE_W),
      kippA: knapp && !sofort && !ruhig() ? 0.2 : 0,
      kippT: 0,
      kippW: 0,
      kippSeite: ende < 0 ? -1 : 1,
    };
    state.stapel.push(neu);
    state.punkte += 1;
    state.combo = combo;
    state.letzte = { off, einschlag };
    shell.setCount(state.punkte);
    gegner?.takt(state.punkte);
    if (!sofort) wirkung(neu, ende, perfekt, knapp, uhr);
    const voll = state.stapel.length >= state.schiff.plan.platz;
    if (voll) schiffVoll(uhr, sofort);
    state.kiste = null;
    neueKiste(uhr + (voll ? NEUES_SCHIFF : 0), k);
  }

  // Was man sieht und hört, wenn ein Container steht.
  function wirkung(neu, ende, perfekt, knapp, uhr) {
    const sch = state.schiff;
    const x = schiffX(sch, uhr) + neu.off;
    const y = spitzeY() - KISTE_H;
    const unter = state.stapel[state.stapel.length - 2];
    if (unter) unter.stauch = Math.max(unter.stauch, 0.45);
    state.wackelV += (ende / (KISTE_W / 2)) * 0.12 + (perfekt ? 0 : 0.04 * Math.sign(ende || 1));
    state.bobV += 5 + state.stapel.length * 0.4;
    staub(x - KISTE_W / 2, y, 5, -1);
    staub(x + KISTE_W / 2, y, 5, 1);
    aufsetzen(1);
    if (perfekt) {
      state.stoss = Math.max(state.stoss, 0.55);
      funken(x - KISTE_W / 2, y, 7);
      funken(x + KISTE_W / 2, y, 7);
      funken(x, y + KISTE_H, 6, "warm");
      schrift(state.combo >= 2 ? `Perfekt ×${state.combo}` : "Perfekt!", x, y + KISTE_H + 18, state.combo >= 3 ? "#7dffa8" : "#ffd23f", 22 + Math.min(10, state.combo * 2));
      // Zum Aufsetzen die Harfe, in Folge die Leiter.
      klang()?.ton(state.combo >= 2 ? "serie" : "perfekt", { stufe: state.combo, laut: 0.75 });
      brumm(24);
    } else if (knapp) {
      state.stoss = Math.max(state.stoss, 0.4);
      state.lupe = LUPE_ZEIT;
      state.wackelV += 0.12 * Math.sign(ende);
      schrift("Knapp!", x, y + KISTE_H + 16, "#ff9f43", 20);
      brumm([12, 40, 12]);
    } else {
      state.stoss = Math.max(state.stoss, 0.3);
      brumm(12);
    }
  }

  // Das Schiff ist voll: Es tutet, legt ab, und das nächste läuft ein.
  function schiffVoll(uhr, sofort) {
    const alt = state.schiff;
    if (!sofort) {
      state.abfahrt.push({ schiff: alt, stapel: state.stapel, t0: uhr, x0: schiffX(alt, uhr), v0: schiffV(alt, uhr) });
      const x = schiffX(alt, uhr);
      for (let i = 0; i < viele(14); i += 1) {
        teil({ art: "dampf", x: x + 80, y: 98 + Math.random() * 4, vx: (Math.random() - 0.3) * 30, vy: 30 + Math.random() * 30, r: 3 + Math.random() * 3, leben: 1 + Math.random() * 0.6, max: 1.6, farbe: "#f4f8ff" });
      }
      for (let i = 0; i < viele(40); i += 1) {
        teil({
          art: "konfetti", x: x + (Math.random() - 0.5) * 60, y: 190 + Math.random() * 40,
          vx: (Math.random() - 0.5) * 120, vy: 40 + Math.random() * 90, r: 1, dreh: Math.random() * 6,
          leben: 1.6 + Math.random() * 0.8, max: 2.4, farbe: FARBEN[i % FARBEN.length].grund,
        });
      }
      schrift("Schiff voll!", 0, 250, "#7dffa8", 28, 1.7, 10, 0.45);
      schrift(`Gute Fahrt, ${SCHIFF_NAMEN[alt.plan.name]}!`, 0, 228, "#ffffff", 15, 1.7, 10, 0.55);
      // Mit der Schrift, nach dem Aufsetzen – nicht darüber.
      klang()?.ton("meilenstein", { verzoegerung: 0.45 });
      brumm([20, 60, 40]);
    }
    state.schiffNr += 1;
    state.schiff = neuesSchiff(state.schiffNr, uhr);
    state.stapel = [];
    state.wackel = 0;
    state.wackelV = 0;
    state.bob = 0;
    state.bobV = 0;
    hafenStellen();
  }

  /*
   * Daneben: Der Container kippt über die Kante (oder fällt ganz vorbei),
   * schlägt vielleicht noch aufs Deck und geht ins Wasser. d: wo er aufschlug
   * (nach dem Rutschen), gegenüber der Mitte darunter.
   */
  function kisteDaneben({ d, vRel, uhr }, sofort) {
    const k = state.kiste;
    const plan = k ? k.plan : state.plan.kisten[Math.min(state.punkte, state.plan.kisten.length - 1)];
    state.kiste = null;
    state.combo = 0;
    hafenAus();
    if (sofort) return;
    const halb = KISTE_W / 2;
    const seite = d < 0 ? -1 : 1;
    const oben = spitzeY();
    const sch = state.schiff;
    const w = {
      x: stuetzeX(uhr) + d, y: oben + KISTE_H / 2, vx: schiffV(sch, uhr) + vRel, vy: -220,
      ang: 0, va: 0, farbe: plan.farbe, alpha: 1, modus: "frei", nass: false, seite,
      kante: spitzeOff() + seite * halb, rel: d - seite * halb, kippW: 0, kippV: 0, stoesse: 0,
    };
    if (Math.abs(d) < KISTE_W) {
      w.modus = "kippen";
      w.kippV = 1.2 + clamp(Math.abs(w.rel) / halb, 0, 1) * 2.5;
      // Er schlägt noch auf der Kante auf, bevor er kippt.
      aufsetzen(0.7);
    }
    state.wracks.push(w);
    state.fehler = { zeit: 0 };
    state.stoss = Math.max(state.stoss, 0.6);
    state.wackelV += seite * 0.25;
    state.lupe = LUPE_ZEIT;
    staub(w.x - seite * halb * 0.5, oben, 8, seite);
    schrift("Daneben!", stuetzeX(uhr), oben + KISTE_H + 40, "#ff6b5a", 26, 1.6, 8);
    schrift(seite > 0 ? "zu weit rechts" : "zu weit links", stuetzeX(uhr), oben + KISTE_H + 20, "#ffffff", 14, 1.6, 8);
  }

  // Ein Container auf dem Weg ins Wasser.
  function wrackSchritt(w, h) {
    const sch = state.schiff;
    if (w.modus === "kippen") {
      // Er dreht sich um die Kante des Containers darunter, immer schneller.
      w.kippV += (5 + w.kippW * 14) * h;
      w.kippW += w.kippV * h;
      const px = schiffX(sch, state.uhr) + w.kante;
      const py = spitzeY();
      const a = -w.seite * w.kippW;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const ux = w.rel + w.seite * 0;
      const uy = KISTE_H / 2;
      const nx = px + ux * c - uy * s;
      const ny = py + ux * s + uy * c;
      if (h > 0) { w.vx = (nx - w.x) / h; w.vy = (ny - w.y) / h; }
      w.x = nx;
      w.y = ny;
      w.ang = a;
      if (w.kippW > 1.0) {
        w.modus = "frei";
        w.va = -w.seite * w.kippV;
        w.vx += w.seite * 30;
      }
      return;
    }
    if (!w.nass) {
      w.vy -= FALL_G * h;
      w.x += w.vx * h;
      w.y += w.vy * h;
      w.ang += w.va * h;
      // Aufs Deck? Dann prallt es ab und rutscht zur nächsten Bordwand.
      const rel = w.x - schiffX(sch, state.uhr);
      if (Math.abs(rel) < 100 && w.vy < 0 && w.stoesse < 3) {
        const sink = (SINK * state.stapel.length) / sch.plan.platz;
        let boden = DECK_Y - sink;
        if (rel > 50 && rel < 98) boden = 78 - sink;
        else if (rel < -76) boden = 29 - sink;
        const halbH = (Math.abs(Math.cos(w.ang)) * KISTE_H + Math.abs(Math.sin(w.ang)) * KISTE_W) / 2;
        if (w.y - halbH < boden && w.y - halbH > boden - 14) {
          const weg = rel > 50 ? 1 : Math.sign(rel) || w.seite;
          w.y = boden + halbH;
          w.vy = Math.abs(w.vy) * 0.32;
          w.vx = w.vx * 0.5 + weg * 110;
          w.va = weg * -3.2;
          w.stoesse += 1;
          state.stoss = Math.max(state.stoss, 0.5);
          funken(w.x, boden, 10);
          staub(w.x, boden, 6, weg);
          aufsetzen(0.55);
        }
      }
      if (w.y < KISTE_H * 0.3) {
        w.nass = true;
        spritzer(w.x, 1);
        state.stoss = Math.max(state.stoss, 0.45);
        platschte = true;
        klang()?.ton("kranhafen.wasser");
      }
      return;
    }
    // Im Wasser: gebremst, sinkt, Blasen steigen
    w.vx *= 1 - 2.5 * h;
    w.vy += (-16 - w.vy) * 4 * h;
    w.va *= 1 - 2 * h;
    w.x += w.vx * h;
    w.y += w.vy * h;
    w.ang += w.va * h;
    w.alpha = Math.max(0, w.alpha - 0.55 * h);
    if (Math.random() < 14 * h) teil({ art: "blase", x: w.x + (Math.random() - 0.5) * KISTE_W, y: Math.min(-1, w.y + KISTE_H / 2), vx: 0, vy: 18 + Math.random() * 12, r: 0.7 + Math.random() * 0.9, leben: 0.6, max: 0.6, farbe: "#cfe2ff" });
  }

  // ---------------------------------------------------------------------------
  // Im Multiplayer und in der Hall of Fame: Zug um Zug
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug) – sofort, wenn etwas
   * geschieht. Jeder sagt den ganzen Stand, nicht nur, was dazukam:
   *
   *   c   Container × 4 + was gerade ist: 0 der nächste hängt am Seil,
   *       1 er fällt, 2 er geht daneben
   *   a   bei 0: wo der oberste steht (gegenüber der Lukenmitte), darüber ab
   *       10⁷ die Reihe genauer Treffer; vor dem ersten Container nichts
   *       bei 1: wo er losgelassen wurde, gegenüber dem Schiff
   *       bei 2: wo er aufschlug, gegenüber dem darunter
   *   b   bei 0: wo der oberste aufschlug (von dort rutschte er hin); vor
   *       dem ersten Container: wie lange die Uhr schon lief, in ms
   *       bei 1 und 2: seine Fahrt gegenüber dem Schiff
   *
   * Alles quer in Hundertstel-Einheiten, wie im Turmbau verschoben um ZUG_X,
   * damit es nie unter null geht. Wer zuschaut, hat dieselben Schiffe und
   * Pendel (dieselbe Saat) und dieselbe Uhr: Er lässt den Container dort
   * los, wo der andere es tat, und stellt ihn dorthin, wo er bei ihm stand.
   */
  const ZUG_X = 5e6;
  const kodiere = (x) => Math.round(x * 100);
  const welt100 = (n) => n / 100;

  function meldeZug(was, e = null) {
    if (state.phase === "zuschauen") return;
    let ort = null;
    if (was === 0) {
      ort = state.punkte === 0
        ? { a: ZUG_X, b: Math.max(0, Math.round(state.uhrVersatz * 1000)), c: 0 }
        : { a: state.combo * 1e7 + kodiere(state.letzte.off) + ZUG_X, b: kodiere(state.letzte.einschlag) + ZUG_X, c: state.punkte * 4 };
    } else if (was === 1 && e) {
      ort = { a: kodiere(e.xRel) + ZUG_X, b: kodiere(e.vRel) + ZUG_X, c: state.punkte * 4 + 1 };
    } else if (was === 2 && e) {
      ort = { a: kodiere(e.ende) + ZUG_X, b: kodiere(e.vRel) + ZUG_X, c: state.punkte * 4 + 2 };
    }
    if (!ort) return;
    aufnahme?.zug(state.punkte, ort);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, ort);
  }

  // Container, die nicht zu sehen waren (ein Zug kam nicht an): Sie stehen
  // gleich da, genau auf dem obersten.
  function auffuellen(bis, uhr) {
    while (state.punkte < bis) {
      if (!state.kiste) neueKiste(uhr, null);
      kisteLandet({ off: spitzeOff(), einschlag: 0, combo: 0, sofort: true, uhr });
    }
  }

  // Er hat losgelassen: an derselben Stelle gegenüber dem Schiff, mit
  // derselben Fahrt. Gefallen wird dann hier, in denselben Schritten.
  function loslassenNach(probe, uhrR, sofort) {
    const k = state.kiste;
    if (!k || k.fallend) return;
    const sch = state.schiff;
    k.fallend = true;
    k.f = {
      x: schiffX(sch, uhrR) + welt100(probe.a - ZUG_X),
      y: kisteY(k, uhrR),
      vx: schiffV(sch, uhrR) + welt100(probe.b - ZUG_X),
      vy: 0,
      aw: windA(sch),
      uhr: uhrR,
      neig: kisteNeig(k, uhrR),
      wartet: false,
    };
    if (!sofort) hakenLos(k, uhrR);
  }

  // Ein Zug des anderen, im Bild. sofort: Er liegt schon zurück (beim
  // Einsteigen) – dann ohne Fallen und ohne Zierde, gleich das Ergebnis.
  function zugAnwenden(probe, sofort) {
    const n = Math.floor(probe.c / 4);
    const was = probe.c - n * 4;
    if (was === 0 && n === 0) {
      state.uhrVersatz = probe.b / 1000;
      return;
    }
    const uhr = probe.t / 1000 + state.uhrVersatz;
    if (was === 0) {
      if (state.punkte < n - 1) auffuellen(n - 1, uhr);
      if (state.punkte !== n - 1) return;
      const kombi = Math.floor(probe.a / 1e7);
      kisteLandet({ off: welt100(probe.a - kombi * 1e7 - ZUG_X), einschlag: welt100(probe.b - ZUG_X), combo: kombi, sofort, uhr });
      return;
    }
    if (state.punkte < n) auffuellen(n, uhr);
    if (state.punkte !== n) return;
    if (was === 1) loslassenNach(probe, uhr, sofort);
    else if (was === 2 && state.kiste) kisteDaneben({ d: welt100(probe.a - ZUG_X), vRel: welt100(probe.b - ZUG_X), uhr }, sofort);
  }

  // Jedes Bild: die Züge, die inzwischen dran sind, und die Uhr des anderen.
  // Was mehr als anderthalb Sekunden zurückliegt, steht gleich da.
  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetzt = zuschauer.jetzt();
    const neu = zuschauer.seit(gesehenBis, jetzt);
    neu.forEach((probe) => {
      zugAnwenden(probe, jetzt - probe.t > 1500);
      gesehenBis = probe.t;
    });
    state.uhr = Math.max(state.uhr, jetzt / 1000 + state.uhrVersatz);
    shell.setCount(state.punkte);
    // Ein Lauf aus der Hall of Fame: am Schluss die Tafel – und der Hafen
    // schweigt, wie auch immer der Lauf endete.
    zuschauer.weiter?.();
    if (zuschauer.fertig?.()) hafenAus();
  }

  // Ab jetzt der Lauf des anderen: von vorn, mit derselben Welt (dieselbe
  // Saat), und dann Zug um Zug, was er gestapelt hat.
  function zuschauenStarten() {
    if (!zuschauer?.seit) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    gesehenBis = -Infinity;
    zuschauer.los?.();
    hafenAn();
    zuschauenTakt();
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  // dt: die Zeit dieses Bildes (gedeckelt), dtUhr: wie weit die Uhr der Runde
  // vorrückt – beim Spielen genau so weit wie die echte Zeit, damit die Züge
  // (die mit der echten Zeit aufgezeichnet werden) zur Uhr passen.
  function schritt(dt, dtUhr) {
    let lupe = 1;
    if (state.lupe > 0) {
      state.lupe = Math.max(0, state.lupe - dt);
      lupe = LUPE_K + (1 - LUPE_K) * sanft(LUPE_ZEIT * 0.55, 0, state.lupe);
    }
    const dtE = dt * lupe;
    state.zeit += dtE;
    if (state.phase === "ende") state.uhr += dtE;
    else if (state.phase !== "zuschauen") state.uhr += dtUhr;
    if (state.stoss > 0) state.stoss = Math.max(0, state.stoss - dt * 3);
    const nacht = clamp(state.punkte / NACHT_KISTEN, 0, 1);
    state.himmel += (nacht - state.himmel) * (1 - Math.exp(-1.2 * dt));

    // Der fallende Container, in festen Schritten bis zur Uhr
    const k = state.kiste;
    if (k?.fallend && k.f && !k.f.wartet) {
      for (let n = 0; n < 2400 && k.f.uhr + TAKT <= state.uhr + 1e-9; n += 1) {
        fallSchritt(k.f, TAKT);
        const oben = spitzeY();
        if (k.f.y <= oben) {
          k.f.y = oben;
          // Wer zuschaut, wartet auf den Zug, der sagt, wie es ausging.
          if (state.phase === "zuschauen") k.f.wartet = true;
          else landen(k);
          break;
        }
      }
    }

    // Laufkatze und Spreader
    if (state.kiste) state.katze = katzeBei(state.kiste, state.uhr);
    const h = state.haken;
    const kk = state.kiste;
    if (kk && !kk.fallend && state.uhr >= kk.spawn) {
      h.x = kisteX(kk, state.uhr);
      h.y = kisteY(kk, state.uhr) + KISTE_H;
      h.neig = kisteNeig(kk, state.uhr);
      h.vx = 0;
      h.vy = 0;
      h.zu = true;
    } else {
      const ty = KATZE_Y - SPREADER_H - 4;
      h.vx += ((state.katze - h.x) * 50 - h.vx * 6) * dtE;
      h.vy += ((ty - h.y) * 70 - h.vy * 7) * dtE;
      h.x += h.vx * dtE;
      h.y += h.vy * dtE;
      if (h.y > ty + 1.5) { h.y = ty + 1.5; h.vy = -Math.abs(h.vy) * 0.35; }
      h.neig *= 1 - Math.min(1, 3 * dtE);
    }

    // Der Stapel: Stauchen, Rutschen, Kippeln, Schwanken
    const ablauf = (stapel) => stapel.forEach((s) => {
      if (s.stauch > 0) s.stauch = Math.max(0, s.stauch - dtE * 8);
      if (s.glanz > 0) s.glanz = Math.max(0, s.glanz - dtE * 2.6);
      if (s.rutsch > 0) s.rutsch = Math.max(0, s.rutsch - dtE * 5);
      if (s.kippA > 0) {
        s.kippT += dtE;
        s.kippW = s.kippA * Math.exp(-3.4 * s.kippT) * Math.abs(Math.sin(s.kippT * 13));
        if (s.kippT > 1.6) { s.kippA = 0; s.kippW = 0; }
      }
    });
    ablauf(state.stapel);
    state.abfahrt.forEach((a) => ablauf(a.stapel));
    state.wackelV += (-state.wackel * 120 - state.wackelV * 5) * dtE;
    state.wackel += state.wackelV * dtE;
    state.bobV += (-state.bob * 60 - state.bobV * 6) * dtE;
    state.bob += state.bobV * dtE;

    // Volle Schiffe fahren hinaus
    for (let i = state.abfahrt.length - 1; i >= 0; i -= 1) {
      if (abfahrtX(state.abfahrt[i], state.uhr) < state.camX - view.w / 2 - 170) state.abfahrt.splice(i, 1);
    }

    // Wracks, Teilchen, Ringe, Schriften
    for (let i = state.wracks.length - 1; i >= 0; i -= 1) {
      const w = state.wracks[i];
      const schritte = Math.max(1, Math.ceil(dtE / TAKT));
      for (let n = 0; n < schritte; n += 1) wrackSchritt(w, dtE / schritte);
      if (w.alpha <= 0) state.wracks.splice(i, 1);
    }
    for (let i = state.teile.length - 1; i >= 0; i -= 1) {
      const t = state.teile[i];
      t.leben -= dtE;
      if (t.leben <= 0) { state.teile.splice(i, 1); continue; }
      if (t.art === "rauch" || t.art === "dampf") {
        t.vx += ((state.schiff?.plan.wind || 0) * 260 - t.vx) * 0.6 * dtE;
        t.vy *= 1 - 0.8 * dtE;
      } else if (t.art === "blase") {
        if (t.y > -0.5) t.leben = 0;
      } else if (t.art === "konfetti") {
        t.vy -= 120 * dtE;
        t.vx *= 1 - 1.5 * dtE;
        t.vy *= 1 - 1.2 * dtE;
        t.dreh += dtE * 9;
      } else {
        t.vy -= FALL_G * (t.art === "staub" ? 0.04 : t.art === "funke" ? 0.35 : 0.5) * dtE;
        if (t.art === "staub") t.vx *= 1 - 2.5 * dtE;
        if (t.art === "tropfen" && t.y < 0) t.leben = 0;
      }
      t.x += t.vx * dtE;
      t.y += t.vy * dtE;
    }
    for (let i = state.wellen.length - 1; i >= 0; i -= 1) {
      const w = state.wellen[i];
      w.leben -= dtE;
      w.r += w.v * dtE;
      w.v *= 1 - 1.4 * dtE;
      if (w.leben <= 0) state.wellen.splice(i, 1);
    }
    for (let i = state.texte.length - 1; i >= 0; i -= 1) {
      const t = state.texte[i];
      if (t.warte > 0) { t.warte -= dtE; continue; }
      t.leben -= dtE;
      if (t.leben <= 0) state.texte.splice(i, 1);
    }
    if (state.fehler) state.fehler.zeit += dtE;

    // Rauch aus den Schornsteinen
    state.rauch += dtE;
    if (state.rauch > 0.11) {
      state.rauch = 0;
      const farbe = state.himmel > 0.5 ? "#4a5062" : "#8a8f9e";
      const qualm = (x, sink) => teil({
        art: "rauch", x: x + 80 + (Math.random() - 0.5) * 3, y: 98 - sink, vx: 4, vy: 16 + Math.random() * 8,
        r: 2 + Math.random() * 1.4, leben: 2.4, max: 2.4, farbe,
      });
      if (state.schiff) qualm(schiffX(state.schiff, state.uhr), (SINK * state.stapel.length) / state.schiff.plan.platz);
      state.abfahrt.forEach((a) => qualm(abfahrtX(a, state.uhr), SINK));
    }

    // Möwen ziehen durchs Bild
    state.moewen.forEach((m) => {
      m.x += m.v * dtE;
      m.y += Math.sin(state.zeit * 0.8 + m.ph) * 4 * dtE;
      const rand = view.w / 2 + 40;
      if (m.v > 0 ? m.x > state.camX + rand : m.x < state.camX - rand) {
        m.x = state.camX - Math.sign(m.v) * rand;
        m.y = 150 + Math.random() * 150;
      }
    });

    // Die Kamera zieht dem Schiff ein wenig nach: so verschieben sich die
    // Ebenen gegeneinander, und der Hafen bekommt Tiefe.
    const zielX = ruhig() || !state.schiff ? 0 : schiffX(state.schiff, state.uhr) * 0.15;
    state.camX += (zielX - state.camX) * (1 - Math.exp(-1.5 * dt));
  }

  function loop(now) {
    frame = window.requestAnimationFrame(loop);
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    messen();
    if (state.phase === "zuschauen") zuschauenTakt();
    let dtUhr = dt;
    if (state.phase === "spiel") dtUhr = clamp(state.uhrVersatz + (now - state.losMs) / 1000 - state.uhr, 0, 1);
    schritt(dt, dtUhr);
    zeichnen(dt);
  }

  // Für die Prüfskripte: ein Schritt ohne requestAnimationFrame. Die Uhr der
  // Runde rückt genau um dt vor (losMs wandert mit, sonst holte die Schleife
  // sie danach auf die echte Zeit zurück).
  function takt(dt) {
    if (state.phase === "spiel") state.losMs -= dt * 1000;
    if (state.phase === "zuschauen") zuschauenTakt();
    schritt(dt, dt);
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    hafenAus();
    platschte = false;
    shell.closeOverlay();
    zufall.neu();
    state.plan = planBauen();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.punkte = 0;
    state.combo = 0;
    state.uhr = 0;
    state.uhrVersatz = 0;
    state.losMs = 0;
    state.schiffNr = 0;
    state.stapel = [];
    state.abfahrt = [];
    state.wracks = [];
    state.teile = [];
    state.wellen = [];
    state.texte = [];
    state.fehler = null;
    state.kiste = null;
    state.letzte = { off: 0, einschlag: 0 };
    state.wackel = 0;
    state.wackelV = 0;
    state.bob = 0;
    state.bobV = 0;
    state.stoss = 0;
    state.lupe = 0;
    state.himmel = 0;
    state.camX = 0;
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    prompt = shell.el("p", "cm-prompt kh-prompt", "Tippe zum Loslassen – triff das Schiff!");
    shell.play.append(prompt, buildPlatz());

    view.cssW = 0;
    view.cssH = 0;
    messen();

    // Das erste Schiff liegt schon unter dem Kran, der erste Container
    // senkt sich gerade herab.
    state.schiff = neuesSchiff(0, -ANKUNFT - 0.01);
    neueKiste(0, null);
    state.katze = katzeBei(state.kiste, 0);
    state.haken = { x: state.katze, y: KATZE_Y - SPREADER_H - 4, vx: 0, vy: 0, zu: true, neig: 0 };
    state.camX = ruhig() ? 0 : schiffX(state.schiff, 0) * 0.15;

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  // Die Zahl auf der Tafel läuft von null hoch.
  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(700, 120 + ziel * 45);
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
    if (state.phase === "zuschauen") return;
    clearStep();
    stopLoop();
    hafenAus();
    if (state.wracks.length && !platschte) klang()?.ton("kranhafen.wasser");
    state.phase = "ende";
    const punkte = state.punkte;
    const geist = aufnahme?.ende(gegner?.ende(punkte) || null) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    const next = recordRun(punkte);
    shell.showResult({
      label: "Deine Container",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : (vorher ? `Bester Hafen: ${vorher}` : null),
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("kh-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Kein Erklärbild und kein Startknopf: Der Container pendelt schon, und der
  // erste Tipp lässt ihn fallen.
  bilder.glut = {
    warm: glutMalen("#ffd28a"),
    weiss: glutMalen("#ffffff"),
    rot: glutMalen("#ff4a3a"),
    gruen: glutMalen("#5dff8a"),
    mond: glutMalen("#cfe0ff"),
    funke: glutMalen("#ffe08a"),
  };
  bilder.wolke = wolkeMalen();
  state.moewen = [0, 1, 2].map((i) => ({
    x: -200 + i * 150, y: 170 + i * 40, v: (i % 2 ? -1 : 1) * (22 + i * 6),
    takt: 8 + i * 1.5, ph: i * 2.1, r: 0.9 + i * 0.12,
  }));

  shell = shellApi.mount({
    host,
    title: "Kranhafen",
    area: "problemloesen",
    accent: "#3FA34D",
    accentDark: "#2c7337",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "craneHarbor", fassung: "z1", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "craneHarbor", host, art: "ziel" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // --- Eingabe ---------------------------------------------------------------
  // Getippt wird auf der ganzen Bühne: Der Container pendelt schnell, und
  // eine kleine Fläche träfe ein Kind dabei nicht. Nur Knöpfe bleiben Knöpfe.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    druecken();
  });
  window.addEventListener("pointerup", loslassen);
  window.addEventListener("pointercancel", loslassen);
  window.addEventListener("blur", loslassen);

  // Leertaste, Enter oder Pfeil nach unten für den Rechner. Steht der Fokus
  // auf einem Knopf, gilt die Taste dem Knopf.
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " && event.key !== "Enter" && event.key !== "ArrowDown") return;
    if (event.repeat) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (state.phase === "bereit" || state.phase === "spiel") druecken();
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); hafenAus(); });

  // Nach aussen sichtbar für die Prüfskripte: der Zustand, ein Schritt ohne
  // Bild (takt), Tippen, und wo der Container landen würde (vorhersage).
  window.LernappKranhafen = {
    WELT_W, KISTE_W, KISTE_H, PERFEKT, EINZUG, RUNS_FOR_DONE,
    state, view, takt, druecken, loslassen, vorhersage,
    plan: () => state.plan,
    schiffX, kisteX, spitzeY, spitzeOff,
  };
})();
