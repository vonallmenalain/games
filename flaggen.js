/*
 * flaggen.js – Flaggenkommando.
 * ---------------------------------------------------------------------------
 * Auf der Brücke eines Segelschiffs steht der Kapitän mit zwei Flaggen: einem
 * roten Wimpel und einer gelben Fahne. Unten auf dem Deck steht, wer spielt,
 * mit denselben zwei. Eine Regel: Zeig immer, was der Kapitän zeigt. Links
 * halten hebt den roten Wimpel, rechts halten die gelbe Fahne – gehalten,
 * nicht getippt: Oben bleibt eine Flagge nur, solange der Daumen liegt.
 *
 * Der Kapitän gibt Kommando um Kommando: rot, gelb, beide, keine. Nach jedem
 * läuft eine Frist, und bis sie um ist, muss unten dasselbe stehen wie oben.
 * Sobald es steht, zählt das Kommando – wer schnell ist, bekommt das nächste
 * früher, und in der ersten guten Hälfte der Frist ist es ein «Blitz» und
 * gibt mehr.
 *
 * Drei Fehler gibt es, und jeder beendet die Runde:
 *
 *   falsch    eine Flagge heben, die der Kapitän nicht oben hat
 *   gesenkt   eine Flagge senken, die er oben hat (ausser in der Frist)
 *   langsam   die Frist ist um, und unten steht nicht, was oben steht
 *
 * Welle um Welle (sechs Kommandos) wird die Frist kürzer, und der Kapitän
 * hat Einfälle:
 *
 *   beide     ab der dritten Welle auch beide Flaggen auf einmal
 *   Finten    ab der vierten zuckt ein Arm, als käme ein Kommando – hebt sich
 *             knapp zur Hälfte und fällt zurück. Der Pfiff kommt auch dann.
 *             Wer auf die erste Bewegung reagiert, statt hinzuschauen, hebt
 *             (oder senkt) falsch.
 *   Kehrt     ab der sechsten dreht er sich manchmal um. Den roten Wimpel
 *             hält er in derselben Hand – im Bild ist er jetzt rechts. Es
 *             gilt die Farbe, nicht die Seite.
 *
 * Dazu zieht ein Sturm auf: Der Himmel wird dunkel, das Schiff rollt, es
 * regnet. Und jede Runde endet: Die Frist fällt weiter, bis sie kürzer ist
 * als jede Reaktion, und ab Welle ENDE_AB ist sie null.
 *
 * Gerechnet wird in festen Schritten (HZ je Sekunde) und nur mit ganzen
 * Schritten – so ist jede Runde auf jedem Gerät dieselbe. Eine Pose ist eine
 * Zahl aus zwei Bits: 1 der rote Wimpel, 2 die gelbe Fahne.
 *
 * Gewürfelt werden die Kommandos, die Pausen, die Finten und die Kehren
 * (zufall.js): ohne Turnier jede Runde anders, im Turnier für alle im
 * selben Versuch gleich.
 *
 * Gegner (geist.js): Platz 1 und die eigene Bestmarke als Zielmarke. Jedes
 * Drücken und Loslassen ist ein Zug (geist.js, zuege; live-spiel.js, zug) mit
 * dem Schritt, in dem es geschah. Wer zuschaut, rechnet dieselbe Runde mit
 * denselben Zügen nach.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "flags") return;

  const host = document.querySelector("#fk-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());

  // Der Zufall: die Kommandos, die Pausen, die Finten, die Kehren. Gischt und
  // Regen würfeln Math.random.
  const zufall = window.LernappZufall?.fuer?.("flagCommand") || {
    fest: false, neu() {}, zahl: Math.random,
  };

  // ---------------------------------------------------------------------------
  // Die Schrauben
  // ---------------------------------------------------------------------------
  const HZ = 240;
  const TAKT = 1 / HZ;             // ein Schritt der Rechnung

  const ROT = 1;                   // der rote Wimpel: links halten
  const GELB = 2;                  // die gelbe Fahne: rechts halten

  const WELLE = 6;                 // Kommandos je Welle
  const FRIST0 = 1.0;              // Sekunden Frist in der ersten Welle …
  const FRIST_FAKTOR = 0.905;      // … und je Welle so viel davon, bis FRIST_KNICK
  const FRIST_KNICK = 13;          // danach fällt sie je Welle um FRIST_MINUS Schritte
  const FRIST_MINUS = 6.5;
  const ENDE_AB = 24;              // ab dieser Welle ist die Frist null
  const BLITZ = 0.55;              // so viel der Frist ist «Blitz»
  const KETTE_MAX = 3;             // so viel gibt ein Blitz in Folge höchstens dazu

  const PAUSE0 = 0.95;             // Sekunden zwischen zwei Kommandos, am Anfang …
  const PAUSE1 = 0.38;             // … und ab Welle PAUSE_BIS (je mal 0,6 bis 1,5)
  const PAUSE_BIS = 12;
  const ANLAUF = 1.0;              // so lange bis zum ersten Kommando

  const BEIDE_AB = 2;              // ab dieser Welle auch beide Flaggen
  const FINTE_AB = 3;              // ab dieser Finten
  const KEHRT_AB = 5;              // ab dieser dreht er sich manchmal um
  const DREH = Math.round(0.7 * HZ);   // so lange dauert die Kehrtwende
  const FINTE_HOCH = 0.45;         // so weit hebt sich der Arm bei einer Finte
  const FINTE_DAUER = Math.round(0.22 * HZ);
  const ARM = 16;                  // Schritte, bis ein Arm oben (oder unten) ist

  // Die Züge.
  const ZUG_START = 0;
  const ZUG_DRUCK = 1;             // + 0 links, + 1 rechts
  const ZUG_LOS = 3;
  const ZUG_ENDE = 5;
  const ZUG_VORHER = 6;            // so viele Züge davor trägt jeder im Multiplayer mit (b)
  const AUFHOLEN_MAX = 48;         // so viele Schritte holt ein Bild höchstens auf

  const TOP_COUNT = 5;
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.flaggen", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const bit = (h) => (h === 0 ? ROT : GELB);

  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  const mischFarbe = (a, b, k) => `rgb(${a.map((x, i) => Math.round(lerp(x, b[i], k))).join(", ")})`;

  // Die Frist einer Welle in Schritten – mit Malnehmen statt Math.pow, damit
  // jede Maschine auf dieselbe Zahl kommt.
  function fristBei(k) {
    if (k >= ENDE_AB) return 0;
    let f = FRIST0;
    for (let i = 0; i < Math.min(k, FRIST_KNICK); i += 1) f *= FRIST_FAKTOR;
    const ticks = Math.round(f * HZ);
    return k <= FRIST_KNICK ? ticks : Math.max(2, Math.round(ticks - (k - FRIST_KNICK) * FRIST_MINUS));
  }
  const pauseBei = (k) => PAUSE0 + (PAUSE1 - PAUSE0) * Math.min(1, k / PAUSE_BIS);
  const finteChance = (k) => Math.min(0.6, 0.2 + 0.05 * (k - FINTE_AB));

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit" (noch kein Tipp), "spiel", "zuschauen", "ende"
  const state = {
    phase: "bereit",
    tick: 0,
    losMs: 0,
    uhrRest: 0,
    plan: { kommandos: [], wellen: 0, letzte: 0 },
    // Der Kapitän: was er zeigt, das wievielte Kommando als Nächstes kommt
    // und wann, ob eines offen ist und bis wann.
    ziel: 0,
    nr: 0,
    naechster: 0,
    offen: false,
    kommandoTick: 0,
    frist: 0,
    finteAb: -1,
    finte: null,           // { flag, tick, runter }
    armSeit: [-999, -999], // seit wann der Arm (rot, gelb) dorthin unterwegs ist
    umgedreht: false,
    drehAb: -1,            // wann die Kehrtwende beginnt
    drehSeit: -9999,
    // Wer spielt: was unten oben ist.
    pose: 0,
    // Die Zahlen.
    punkte: 0,
    kommandos: 0,
    blitze: 0,
    kette: 0,
    besteKette: 0,
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

  const view = { dpr: 1, cssW: 0, cssH: 0, frei: 0, e: 80, cx: 0, ky: 0 };

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge (klang.js)
  // ---------------------------------------------------------------------------
  const zuletzt = new Map();
  function ton(id, o = {}, pause = 60) {
    if (state.stumm) return;
    const ms = performance.now();
    if (ms - (zuletzt.get(id) ?? -1e9) < pause) return;
    zuletzt.set(id, ms);
    klang()?.ton?.(id, o);
  }
  // Der Wind: stärker, je weiter der Sturm ist.
  let wind = null;
  function windTakt() {
    const an = (state.phase === "spiel" || state.phase === "zuschauen") && !state.fehler;
    if (!an) { wind?.stop(); wind = null; return; }
    if (!wind || !wind.laeuft) wind = klang()?.kulisse?.("flaggen.wind") || null;
    const k = wetter();
    wind?.setze(0.2 + 0.8 * k);
    wind?.laut(0.3 + 0.7 * k);
  }
  function klangAus() {
    wind?.stop();
    wind = null;
  }
  const brumm = (muster) => { if (state.phase === "spiel" && !state.stumm) kids()?.vibrate?.(muster); };

  // ---------------------------------------------------------------------------
  // Der Plan: die Wellen
  // ---------------------------------------------------------------------------
  /*
   * Eine Welle sind WELLE Kommandos. Je Welle werden immer gleich viele
   * Zahlen gezogen (eine und fünf je Kommando) – so hängt der Plan nur an der
   * Saat, nicht daran, wie weit jemand kommt.
   *
   * Ein Kommando: { welle, j, pose, warte, frist, blitz, kehrt, finte }.
   * warte sind die Schritte vom vorigen Kommando (sobald es steht) bis zu
   * diesem; kehrt – davor dreht er sich um; finte – { flag, versatz }: so
   * viele Schritte vor dem Kommando zuckt dieser Arm (0: zugleich mit ihm).
   */
  function welleBauen(k) {
    const z = [];
    for (let i = 0; i < 1 + WELLE * 5; i += 1) z.push(zufall.zahl());
    const kehrt = k >= KEHRT_AB && z[0] < 0.5;
    const frist = fristBei(k);
    const posen = k < BEIDE_AB ? [0, ROT, GELB] : [0, ROT, GELB, ROT | GELB];
    for (let j = 0; j < WELLE; j += 1) {
      const zz = z.slice(1 + j * 5, 6 + j * 5);
      const vor = state.plan.letzte;
      const erstes = k === 0 && j === 0;
      const wahl = erstes ? [ROT, GELB] : posen.filter((p) => p !== vor);
      const pose = wahl[Math.min(wahl.length - 1, Math.floor(zz[0] * wahl.length))];
      let warte = erstes ? Math.round(ANLAUF * HZ) : Math.round(pauseBei(k) * (0.6 + zz[1] * 0.9) * HZ);
      const mitKehrt = kehrt && j === 0;
      if (mitKehrt) warte += DREH + Math.round(0.25 * HZ);
      let finte = null;
      if (k >= FINTE_AB && zz[2] < finteChance(k)) {
        // Zugleich mit dem Kommando zuckt nur ein Arm, der dabei bleibt, wo
        // er ist. Allein zuckt einer mitten in der Pause, wenn sie lang
        // genug ist.
        const bleibt = [ROT, GELB].filter((f) => ((vor ^ pose) & f) === 0);
        const allein = !mitKehrt && warte >= Math.round(0.55 * HZ);
        if (zz[3] < 0.5 && bleibt.length) finte = { flag: bleibt[Math.min(bleibt.length - 1, Math.floor(zz[4] * bleibt.length))], versatz: 0 };
        else if (allein) finte = { flag: zz[4] < 0.5 ? ROT : GELB, versatz: Math.round(warte * 0.5) };
      }
      state.plan.kommandos.push({ welle: k, j, pose, warte, frist, blitz: Math.round(frist * BLITZ), kehrt: mitKehrt, finte });
      state.plan.letzte = pose;
    }
    state.plan.wellen += 1;
  }

  function planBis(nr) {
    while (state.plan.kommandos.length <= nr) welleBauen(state.plan.wellen);
  }
  const kommandoBei = (nr) => { planBis(nr); return state.plan.kommandos[nr]; };

  // Die gewürfelte Welt in Worten (für die Prüfung): die ersten zwölf Wellen,
  // je Kommando die Pose, dahinter f (Finte davor) oder F (Finte zugleich)
  // mit dem Arm, K vor einer Welle mit Kehrtwende.
  function weltText() {
    planBis(12 * WELLE);
    const raus = [];
    for (let k = 0; k < 12; k += 1) {
      const liste = state.plan.kommandos.slice(k * WELLE, (k + 1) * WELLE);
      raus.push((liste[0].kehrt ? "K" : "") + liste.map((c) => c.pose + (c.finte ? (c.finte.versatz ? "f" : "F") + c.finte.flag : "")).join(""));
    }
    return raus.join(" ");
  }

  // ---------------------------------------------------------------------------
  // Die Runde
  // ---------------------------------------------------------------------------
  const welleJetzt = () => kommandoBei(state.nr).welle;
  // Wie weit der Sturm ist: 0 heiter, 1 Sturm.
  const wetter = () => (state.phase === "bereit" ? 0 : clamp((welleJetzt() - 3) / 9, 0, 1));

  // Ein Fehler: Die Runde ist vorbei.
  function patzer(grund, flag = 0) {
    const st = state;
    if (st.fehler) return;
    st.fehler = { tick: st.tick, grund, flag, nr: st.nr };
    st.kette = 0;
    if (st.stumm) return;
    st.bild.fehler = st.echt;
    gischt(40);
    schrift(GRUND_KURZ[grund], 0, -3.5, "#ff7a6b", 30, 1.7);
    ton("flaggen.platsch", { laut: 0.9 }, 300);
    ton("fehler", { verzoegerung: 0.2 }, 300);
    brumm([30, 40, 60]);
    if (st.phase === "spiel") {
      meldeZug(ZUG_ENDE);
      clearStep();
      stepTimer = window.setTimeout(finish, 1500);
    }
  }

  // Der Kapitän gibt das nächste Kommando.
  function kommandoGeben() {
    const st = state;
    const c = kommandoBei(st.nr);
    const vor = st.ziel;
    st.ziel = c.pose;
    st.offen = true;
    st.kommandoTick = st.tick;
    st.frist = st.tick + c.frist;
    if ((vor ^ c.pose) & ROT) st.armSeit[0] = st.tick;
    if ((vor ^ c.pose) & GELB) st.armSeit[1] = st.tick;
    if (c.finte && c.finte.versatz === 0) finteGeben(c.finte.flag);
    if (st.stumm) return;
    st.bild.kommando = st.echt;
    ton("flaggen.pfiff", { laut: 0.8 }, 50);
  }

  // Eine Finte: Der Arm zuckt, als käme ein Kommando.
  function finteGeben(flag) {
    const st = state;
    st.finte = { flag, tick: st.tick, runter: Boolean(st.ziel & flag) };
    if (st.stumm) return;
    ton("flaggen.pfiff", { laut: 0.8 }, 50);
  }

  // Unten steht, was oben steht: Das Kommando zählt.
  function bestaetigen() {
    const st = state;
    const c = kommandoBei(st.nr);
    const dauer = st.tick - st.kommandoTick;
    const blitz = dauer <= c.blitz;
    st.offen = false;
    st.kommandos += 1;
    st.punkte += 1;
    if (blitz) {
      st.kette += 1;
      st.blitze += 1;
      st.besteKette = Math.max(st.besteKette, st.kette);
      st.punkte += Math.min(st.kette, KETTE_MAX);
    } else {
      st.kette = 0;
    }
    // Das nächste: nach seiner Pause – und davor vielleicht eine Kehrtwende
    // oder eine Finte.
    st.nr += 1;
    const n = kommandoBei(st.nr);
    st.naechster = st.tick + n.warte;
    st.drehAb = n.kehrt ? st.tick + Math.round(0.12 * HZ) : -1;
    st.finteAb = n.finte && n.finte.versatz > 0 ? st.naechster - n.finte.versatz : -1;
    if (st.stumm) return;
    setzeZahl();
    st.bild.richtig = st.echt;
    const plus = 1 + (blitz ? Math.min(st.kette, KETTE_MAX) : 0);
    state.schriften = state.schriften.filter((t) => !t.plus);
    schrift(blitz ? (st.kette >= 2 ? `Blitz ×${st.kette}! +${plus}` : `Blitz! +${plus}`) : "+1", 0, -3.5, blitz ? "#ffd23f" : "#ffffff", blitz ? 22 : 18, 0.9);
    state.schriften[state.schriften.length - 1].plus = true;
    if (blitz) { ton("perfekt", { laut: 0.6 }, 160); brumm([8, 24, 10]); }
    if (n.j === 0) neueWelle(n);
  }

  function neueWelle(n) {
    const k = n.welle;
    let text = `Welle ${k + 1}`;
    if (n.kehrt) text = "Kehrt!";
    else if (k === BEIDE_AB) text = "Auch beide!";
    else if (k === FINTE_AB) text = "Achtung, Finten!";
    state.ansage = { text, klein: text.startsWith("Welle") ? "" : `Welle ${k + 1}`, seit: state.echt };
  }

  function simSchritt() {
    const st = state;
    if (st.fehler) return;
    if (st.drehAb >= 0 && st.tick >= st.drehAb) {
      st.drehAb = -1;
      st.drehSeit = st.tick;
      st.umgedreht = !st.umgedreht;
      if (!st.stumm) { st.bild.kehrt = st.echt; ton("flaggen.kehrt", { laut: 0.7 }, 200); }
    }
    if (st.finteAb >= 0 && st.tick >= st.finteAb) {
      st.finteAb = -1;
      finteGeben(kommandoBei(st.nr).finte.flag);
    }
    if (!st.offen && st.tick >= st.naechster) kommandoGeben();
    if (st.offen) {
      if (st.pose === st.ziel) bestaetigen();
      else if (st.tick >= st.frist) { patzer("langsam"); return; }
    }
    st.tick += 1;
  }

  // Heben: nur, was der Kapitän oben hat.
  function druck(h) {
    const st = state;
    const f = bit(h);
    if (st.fehler || (st.pose & f)) return;
    st.pose |= f;
    if (!st.stumm) { st.bild.arm[h] = st.echt; ton("flaggen.flagge", { laut: 0.35 }, 40); }
    if (!(st.ziel & f)) patzer("falsch", f);
  }

  // Senken: Was er oben hat, bleibt oben – ausser in der Frist.
  function los(h) {
    const st = state;
    const f = bit(h);
    if (st.fehler || !(st.pose & f)) return;
    st.pose &= ~f;
    if (!st.stumm) st.bild.arm[h] = st.echt;
    if (!st.offen && (st.ziel & f)) patzer("gesenkt", f);
  }

  function simZuruecksetzen() {
    const st = state;
    st.tick = 0;
    st.ziel = 0;
    st.nr = 0;
    st.naechster = kommandoBei(0).warte;
    st.offen = false;
    st.kommandoTick = 0;
    st.frist = 0;
    st.finteAb = -1;
    st.finte = null;
    st.armSeit = [-999, -999];
    st.umgedreht = false;
    st.drehAb = -1;
    st.drehSeit = -9999;
    st.pose = 0;
    st.punkte = 0;
    st.kommandos = 0;
    st.blitze = 0;
    st.kette = 0;
    st.besteKette = 0;
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
   *   c   die laufende Nummer × 8 + was: 0 Start, 1/2 Drücken links/rechts,
   *       3/4 Loslassen links/rechts, 5 das Ende
   *   b   im Multiplayer die bis zu sechs Züge davor, wenn sie höchstens 15
   *       Schritte zurückliegen: je 1 + was + 8 × wie viele Schritte davor,
   *       in Stellen zu 256. Dort werden Züge, die innert 40 ms kommen, zu
   *       einem (live-spiel.js, zug) – zwei Daumen zugleich sind genau das.
   *       In der Aufzeichnung für die Hall of Fame fehlt keiner; dort ist b
   *       null.
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

  // Eine Eingabe im Spiel: erst melden, dann rechnen – ein falscher Griff
  // beendet die Runde, und das Ende soll nach ihm in der Liste stehen.
  function eingabe(h, runter) {
    const st = state;
    if (st.fehler) return;
    const oben = Boolean(st.pose & bit(h));
    if (runter === oben) return;
    meldeZug((runter ? ZUG_DRUCK : ZUG_LOS) + h);
    if (runter) druck(h); else los(h);
  }

  // Ein Zug des anderen, im selben Schritt.
  function zugAnwenden(e) {
    const was = e.was;
    if (was === ZUG_DRUCK || was === ZUG_DRUCK + 1) druck(was - ZUG_DRUCK);
    else if (was === ZUG_LOS || was === ZUG_LOS + 1) los(was - ZUG_LOS);
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
    if (state.fehler) state.bild.fehler = state.echt - 5;
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
    // Über das Ende hinaus rechnet niemand: Der letzte Zug ist der Fehler –
    // und der Schritt, in dem er geschah, gehört noch dazu.
    const ende = zugListe.find((e) => e.was === ZUG_ENDE);
    if (ende) ziel = Math.min(ziel, ende.a + 1);
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
  // Alles in Einheiten e um den Punkt unter den Füssen des Kapitäns.
  function teil(o) {
    if (state.teile.length > 260) state.teile.shift();
    state.teile.push(o);
  }

  // Die Welle, die über das Deck schlägt.
  function gischt(anzahl) {
    if (ruhig()) anzahl = Math.ceil(anzahl / 3);
    const breit = view.cssW / view.e / 2;
    for (let i = 0; i < anzahl; i += 1) {
      const seite = Math.random() < 0.5 ? -1 : 1;
      teil({ art: "gischt", x: seite * (breit + 0.2), y: 1.5 + Math.random() * 2.5, vx: -seite * (3 + Math.random() * 6), vy: -(2 + Math.random() * 5), r: 0.06 + Math.random() * 0.12, leben: 0.6 + Math.random() * 0.7, max: 1.3 });
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
      t.vy += 9 * dt;
      t.leben -= dt;
      if (t.leben <= 0) state.teile.splice(i, 1);
    }
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      state.schriften[i].leben -= dt;
      if (state.schriften[i].leben <= 0) state.schriften.splice(i, 1);
    }
    if (state.ansage && state.echt - state.ansage.seit > 1.6) state.ansage = null;
    // Das Wetter im Bild zieht dem gerechneten nach.
    state.bild.wetter += (wetter() - state.bild.wetter) * Math.min(1, dt * 0.8);
    windTakt();
  }

  const neuesBild = () => ({ kommando: -9, richtig: -9, fehler: -9, kehrt: -9, arm: [-9, -9], wetter: 0 });

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  function buildPlatz() {
    const platz = shell.el("div", "fk-platz");
    feld = shell.el("div", "fk-feld");
    canvas = document.createElement("canvas");
    canvas.className = "fk-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    platz.append(feld);
    return platz;
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = shellApi.bildpunkte(cssW, cssH, 2.5);
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
    // Die Einheit e: Der Kapitän ist gut zweieinhalb davon gross, mit
    // erhobenen Flaggen drei hoch und gut vier breit.
    const nutzH = cssH - frei;
    view.e = Math.min(cssW / 5.2, nutzH / 7.6);
    view.cx = cssW / 2;
    view.ky = frei + nutzH * 0.56;
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  const HIMMEL_OBEN = [[64, 148, 226], [44, 52, 74]];
  const HIMMEL_UNTEN = [[188, 226, 250], [104, 112, 128]];
  const SEE_OBEN = [[30, 108, 178], [44, 66, 84]];
  const SEE_UNTEN = [[16, 62, 124], [22, 36, 52]];

  // Himmel und See rollen gegen das Schiff: Der Horizont kippt.
  function zeichneWelt() {
    const st = state;
    const W = view.cssW;
    const H = view.cssH;
    const E = view.e;
    const w = st.bild.wetter;
    const hz = view.ky - 1.25 * E;
    const rollen = ruhig() ? 0 : Math.sin(st.echt * 0.8) * (0.012 + 0.045 * w) + Math.sin(st.echt * 1.7) * 0.012 * w;
    const heben = ruhig() ? 0 : Math.sin(st.echt * 1.1 + 1) * E * (0.03 + 0.1 * w);
    g.save();
    g.translate(view.cx, hz + heben);
    g.rotate(rollen);
    const R = Math.hypot(W, H);
    const himmel = g.createLinearGradient(0, -R * 0.7, 0, 0);
    himmel.addColorStop(0, mischFarbe(HIMMEL_OBEN[0], HIMMEL_OBEN[1], w));
    himmel.addColorStop(1, mischFarbe(HIMMEL_UNTEN[0], HIMMEL_UNTEN[1], w));
    g.fillStyle = himmel;
    g.fillRect(-R, -R, R * 2, R);
    // Die Sonne, solange sie scheint.
    if (w < 0.7) {
      g.globalAlpha = 1 - w / 0.7;
      const sx = -W * 0.3;
      const sy = -E * 4.2;
      const hof = g.createRadialGradient(sx, sy, E * 0.2, sx, sy, E * 1.6);
      hof.addColorStop(0, "rgba(255, 244, 200, 0.9)");
      hof.addColorStop(1, "rgba(255, 244, 200, 0)");
      g.fillStyle = hof;
      g.fillRect(sx - E * 1.6, sy - E * 1.6, E * 3.2, E * 3.2);
      g.fillStyle = "#fff6d2";
      g.beginPath();
      g.arc(sx, sy, E * 0.34, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    // Wolken: weiss und klein, dann grau und schwer.
    const wolke = (x, y, b, farbe, a) => {
      g.globalAlpha = a;
      g.fillStyle = farbe;
      g.beginPath();
      g.ellipse(x, y, b, b * 0.3, 0, 0, TAU);
      g.ellipse(x - b * 0.35, y - b * 0.16, b * 0.42, b * 0.26, 0, 0, TAU);
      g.ellipse(x + b * 0.2, y - b * 0.24, b * 0.5, b * 0.32, 0, 0, TAU);
      g.ellipse(x + b * 0.55, y - b * 0.06, b * 0.36, b * 0.2, 0, 0, TAU);
      g.fill();
    };
    const zug = ruhig() ? 0 : st.echt * E * (0.05 + 0.3 * w);
    const breite = W + E * 6;
    for (let i = 0; i < 7; i += 1) {
      const x = mod(hash01(i * 3.7) * breite + zug * (0.6 + hash01(i * 1.9)), breite) - breite / 2;
      const y = -E * (1.2 + hash01(i * 5.3) * 4.2);
      const b = E * (0.7 + hash01(i * 2.3) * 0.9) * (1 + w * 0.9);
      wolke(x, y, b, mischFarbe([255, 255, 255], [70, 76, 92], w), 0.85);
    }
    if (w > 0.25) {
      for (let i = 0; i < 6; i += 1) {
        const x = mod(hash01(i * 7.1 + 3) * breite + zug * 1.6, breite) - breite / 2;
        wolke(x, -E * (3 + hash01(i * 4.1) * 3.2), E * (1.6 + hash01(i * 1.1) * 1.4), "#3a3f52", clamp((w - 0.25) * 1.3, 0, 0.9));
      }
    }
    g.globalAlpha = 1;
    // Die See: bis weit unter das Deck.
    const see = g.createLinearGradient(0, 0, 0, E * 3);
    see.addColorStop(0, mischFarbe(SEE_OBEN[0], SEE_OBEN[1], w));
    see.addColorStop(1, mischFarbe(SEE_UNTEN[0], SEE_UNTEN[1], w));
    g.fillStyle = see;
    g.fillRect(-R, 0, R * 2, R);
    // Wellenkämme: Streifen, die zum Betrachter hin breiter werden.
    g.strokeStyle = `rgba(255, 255, 255, ${0.22 + 0.2 * w})`;
    g.lineCap = "round";
    for (let i = 0; i < 9; i += 1) {
      const tief = (i + 1) / 9;
      const y = E * (0.08 + tief * tief * 2.4);
      const lang = E * (0.25 + tief * 0.9);
      g.lineWidth = Math.max(1, E * 0.015 * (1 + tief * 2 + w * 2));
      const lauf = ruhig() ? 0 : st.echt * E * (0.2 + tief * 0.6) * (1 + w * 1.5);
      for (let n = 0; n < 8; n += 1) {
        const x = mod(hash01(i * 9.3 + n * 4.7) * breite + lauf, breite) - breite / 2;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + lang / 2, y - E * 0.05 * (1 + w * 2), x + lang, y);
        g.stroke();
      }
    }
    // Der Blitz im Sturm: selten, kurz, hinter den Wolken.
    if (w > 0.8 && !ruhig() && hash01(Math.floor(st.echt * 3)) < 0.06) {
      g.fillStyle = "rgba(230, 240, 255, 0.35)";
      g.fillRect(-R, -R, R * 2, R);
    }
    g.restore();
  }

  // Regen: schräge Striche über allem, je nach Wetter.
  function zeichneRegen() {
    const w = state.bild.wetter;
    if (w < 0.4 || ruhig()) return;
    const E = view.e;
    const anzahl = Math.round((w - 0.4) * 110);
    g.save();
    g.strokeStyle = `rgba(210, 225, 245, ${0.25 + 0.3 * w})`;
    g.lineWidth = 1.2;
    for (let i = 0; i < anzahl; i += 1) {
      const t = state.echt * (1.6 + hash01(i * 2.1) * 0.8) + hash01(i * 5.7);
      const x = mod(hash01(i * 3.3) * (view.cssW + 200) - (t % 1) * 160, view.cssW + 200) - 100;
      const y = (t % 1) * (view.cssH + 60) - 30;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - E * 0.12, y + E * 0.36);
      g.stroke();
    }
    g.restore();
  }

  // Der Mast hinter dem Kapitän, mit Wanten und Wimpel, und das Geländer.
  function zeichneMast() {
    const E = view.e;
    const cx = view.cx;
    const ky = view.ky;
    const st = state;
    g.save();
    g.lineCap = "round";
    // Wanten: von weit oben zu den Ecken der Brücke.
    g.strokeStyle = "rgba(40, 30, 22, 0.7)";
    g.lineWidth = Math.max(1, E * 0.018);
    for (const seite of [-1, 1]) {
      for (const k of [0.75, 1.3, 1.85]) {
        g.beginPath();
        g.moveTo(cx + seite * E * 0.05, ky - E * 6.2);
        g.lineTo(cx + seite * E * k * 1.15, ky);
        g.stroke();
      }
    }
    // Der Mast.
    const holz = g.createLinearGradient(cx - E * 0.14, 0, cx + E * 0.14, 0);
    holz.addColorStop(0, "#6b4426");
    holz.addColorStop(0.5, "#a06a3c");
    holz.addColorStop(1, "#5a3920");
    g.fillStyle = holz;
    g.fillRect(cx - E * 0.13, -10, E * 0.26, ky + 10);
    // Die Rah mit dem aufgerollten Segel.
    const ry = ky - E * 3.75;
    g.fillStyle = "#5a3920";
    g.fillRect(cx - E * 2.3, ry, E * 4.6, E * 0.1);
    g.fillStyle = "#efe6d2";
    for (let i = 0; i < 9; i += 1) {
      g.beginPath();
      g.ellipse(cx - E * 2.05 + i * E * 0.51, ry + E * 0.2, E * 0.27, E * 0.14, 0, 0, TAU);
      g.fill();
    }
    // Das Geländer der Brücke.
    g.strokeStyle = "#5a3920";
    g.lineWidth = E * 0.07;
    for (let i = -4; i <= 4; i += 1) {
      g.beginPath();
      g.moveTo(cx + i * E * 0.52, ky);
      g.lineTo(cx + i * E * 0.52, ky - E * 0.62);
      g.stroke();
    }
    g.lineWidth = E * 0.1;
    g.strokeStyle = "#7a4e2c";
    g.beginPath();
    g.moveTo(cx - E * 2.2, ky - E * 0.64);
    g.lineTo(cx + E * 2.2, ky - E * 0.64);
    g.stroke();
    // Zwei Möwen, solange es schön ist.
    const w = st.bild.wetter;
    if (w < 0.5) {
      g.strokeStyle = `rgba(255, 255, 255, ${0.9 * (1 - w * 2)})`;
      g.lineWidth = Math.max(1.2, E * 0.022);
      for (let i = 0; i < 2; i += 1) {
        const t = ruhig() ? i : st.echt * 0.25 + i * 1.7;
        const x = cx + Math.sin(t * 1.3 + i) * view.cssW * 0.38;
        const y = ky - E * (4.4 + i * 0.5) + Math.cos(t * 2.1) * E * 0.3;
        const fl = ruhig() ? 0.3 : Math.sin(st.echt * 7 + i) * 0.5;
        g.beginPath();
        g.moveTo(x - E * 0.2, y - E * 0.08 * fl);
        g.quadraticCurveTo(x - E * 0.08, y - E * 0.12, x, y);
        g.quadraticCurveTo(x + E * 0.08, y - E * 0.12, x + E * 0.2, y - E * 0.08 * fl);
        g.stroke();
      }
    }
    g.restore();
  }

  // Die Brücke, auf der er steht, und das Deck davor.
  function zeichneDeck() {
    const E = view.e;
    const cx = view.cx;
    const ky = view.ky;
    const W = view.cssW;
    const H = view.cssH;
    const st = state;
    g.save();
    // Das Deck: Planken, die auf den Mast zulaufen.
    const dy = ky + E * 0.95;
    const deck = g.createLinearGradient(0, dy, 0, H);
    deck.addColorStop(0, "#8a5c36");
    deck.addColorStop(1, "#b98552");
    g.fillStyle = deck;
    g.fillRect(0, dy, W, H - dy);
    g.strokeStyle = "rgba(60, 36, 18, 0.45)";
    g.lineWidth = Math.max(1, E * 0.02);
    const fy = ky - E * 2;
    for (let i = -9; i <= 9; i += 1) {
      const x0 = cx + i * E * 0.5;
      const x1 = cx + (x0 - cx) * ((H - fy) / (dy - fy));
      g.beginPath();
      g.moveTo(x0, dy);
      g.lineTo(x1, H);
      g.stroke();
    }
    // Die Brücke: ein Kasten aus Brettern, oben die Kante.
    const bw = E * 2.25;
    const front = g.createLinearGradient(0, ky, 0, dy);
    front.addColorStop(0, "#7a4e2c");
    front.addColorStop(1, "#5d3a20");
    g.fillStyle = front;
    g.fillRect(cx - bw, ky, bw * 2, dy - ky);
    g.strokeStyle = "rgba(40, 24, 12, 0.5)";
    for (let i = -4; i <= 4; i += 1) {
      g.beginPath();
      g.moveTo(cx + i * E * 0.5, ky + E * 0.1);
      g.lineTo(cx + i * E * 0.5, dy);
      g.stroke();
    }
    g.fillStyle = "#a9713f";
    g.fillRect(cx - bw - E * 0.08, ky - E * 0.02, bw * 2 + E * 0.16, E * 0.14);
    // Die Frist: ein Balken an der Brücke. Der goldene Teil ist «Blitz».
    const bx0 = cx - E * 1.7;
    const by0 = ky + E * 0.36;
    const bb = E * 3.4;
    const bh = E * 0.2;
    g.fillStyle = "rgba(20, 12, 6, 0.55)";
    g.beginPath();
    if (g.roundRect) g.roundRect(bx0 - 3, by0 - 3, bb + 6, bh + 6, bh);
    else g.rect(bx0 - 3, by0 - 3, bb + 6, bh + 6);
    g.fill();
    if (st.offen && !st.fehler && st.phase !== "bereit") {
      const c = kommandoBei(st.nr);
      const rest = c.frist ? clamp((st.frist - st.tick) / c.frist, 0, 1) : 0;
      const blitz = rest > 1 - BLITZ;
      g.fillStyle = blitz ? "#ffd23f" : rest < 0.25 ? "#ff5a4a" : "#ffffff";
      g.beginPath();
      if (g.roundRect) g.roundRect(bx0, by0, Math.max(bh, bb * rest), bh, bh / 2);
      else g.rect(bx0, by0, bb * rest, bh);
      g.fill();
      // Die Marke, bis zu der es ein Blitz ist.
      g.fillStyle = "rgba(20, 12, 6, 0.7)";
      g.fillRect(bx0 + bb * (1 - BLITZ) - 1, by0 - 2, 2, bh + 4);
    }
    g.restore();
  }

  // Wie weit ein Arm des Kapitäns oben ist (0 unten, 1 oben) – mit der
  // Bewegung des letzten Kommandos und der Finte.
  function armKapitaen(h) {
    const st = state;
    const f = bit(h);
    const zielWert = st.phase === "bereit" ? 0 : (st.ziel & f ? 1 : 0);
    const k = clamp((st.tick - st.armSeit[h]) / ARM, 0, 1);
    const weg = 1 - (1 - k) * (1 - k) * (1 - k);
    let a = lerp(1 - zielWert, zielWert, weg);
    if (k < 1) a += (zielWert ? 1 : -1) * 0.07 * Math.sin(k * Math.PI);
    // Die Finte: steigt wie ein echtes Kommando, bleibt aber knapp unter der
    // Hälfte hängen und fällt zurück.
    if (st.finte && st.finte.flag === f) {
      const t = st.tick - st.finte.tick;
      if (t >= 0 && t < FINTE_DAUER) {
        const kk = clamp(t / ARM, 0, 1);
        const hoch = Math.min(FINTE_HOCH, 1 - (1 - kk) * (1 - kk) * (1 - kk));
        const ab = clamp((FINTE_DAUER - t) / (FINTE_DAUER * 0.5), 0, 1);
        a += (st.finte.runter ? -1 : 1) * hoch * ab;
      }
    }
    return a;
  }

  // Eine Flagge am Ende eines Stocks: der rote Wimpel oder die gelbe Fahne.
  // (x, y) das Stockende, (ux, uy) die Richtung des Stocks, gross der Massstab,
  // wehen eine Zahl, damit nicht alle Tücher im Gleichschritt wehen.
  function zeichneTuch(x, y, ux, uy, gross, f, wehen) {
    const E = view.e * gross;
    // Das Tuch hängt am letzten Stück des Stocks und weht quer dazu, immer
    // nach aussen – vom Körper weg.
    const aussen = (-uy >= 0) === (ux >= 0) ? 1 : -1;
    const nx = -uy * aussen;
    const ny = ux * aussen;
    const lang = E * 0.62;
    const breit = E * 0.5;
    const ax = x - ux * breit;
    const ay = y - uy * breit;
    const welle = (k) => (ruhig() ? 0 : Math.sin(state.echt * 9 + k * 3 + wehen) * E * 0.045 * k);
    g.beginPath();
    g.moveTo(x, y);
    if (f === ROT) {
      // Der Wimpel: ein Dreieck.
      const mx = (x + ax) / 2 + nx * lang * 1.25 + ux * welle(1);
      const my = (y + ay) / 2 + ny * lang * 1.25 + uy * welle(1);
      g.quadraticCurveTo((x + mx) / 2 + ux * welle(0.5), (y + my) / 2 + uy * welle(0.5), mx, my);
      g.quadraticCurveTo((ax + mx) / 2 - ux * welle(0.5), (ay + my) / 2 - uy * welle(0.5), ax, ay);
    } else {
      // Die Fahne: ein Rechteck mit welligem Rand.
      const bx1 = x + nx * lang + ux * welle(1);
      const by1 = y + ny * lang + uy * welle(1);
      const cx1 = ax + nx * lang + ux * welle(1);
      const cy1 = ay + ny * lang + uy * welle(1);
      g.quadraticCurveTo((x + bx1) / 2 + ux * welle(0.6), (y + by1) / 2 + uy * welle(0.6), bx1, by1);
      g.lineTo(cx1, cy1);
      g.quadraticCurveTo((ax + cx1) / 2 + ux * welle(0.6), (ay + cy1) / 2 + uy * welle(0.6), ax, ay);
    }
    g.closePath();
    g.fillStyle = f === ROT ? "#e23b2e" : "#ffd23f";
    g.fill();
    g.strokeStyle = f === ROT ? "#8f1d14" : "#a67c00";
    g.lineWidth = Math.max(1, E * 0.03);
    g.stroke();
    if (f === GELB) {
      // Ein schwarzer Punkt: Die Fahne erkennt man auch ohne Farbe.
      g.fillStyle = "#1c1a16";
      g.beginPath();
      g.arc((x + ax) / 2 + nx * lang * 0.5, (y + ay) / 2 + ny * lang * 0.5, E * 0.1, 0, TAU);
      g.fill();
    }
  }

  // Ein Arm mit Stock und Flagge. seite −1 links im Bild, 1 rechts; a wie
  // weit oben; gross der Massstab der Figur.
  function zeichneArm(sx, sy, seite, a, gross, f, aermel, hand) {
    const E = view.e * gross;
    const winkel = lerp(-1.08, 1.0, a);
    const ux = seite * Math.cos(winkel);
    const uy = -Math.sin(winkel);
    const hx = sx + ux * E * 0.78;
    const hy = sy + uy * E * 0.78;
    const ex = sx + ux * E * 1.85;
    const ey = sy + uy * E * 1.85;
    g.lineCap = "round";
    // Der Stock, dann das Tuch, dann der Arm darüber.
    g.strokeStyle = "#d9c7a0";
    g.lineWidth = E * 0.06;
    g.beginPath();
    g.moveTo(hx - ux * E * 0.12, hy - uy * E * 0.12);
    g.lineTo(ex, ey);
    g.stroke();
    zeichneTuch(ex, ey, ux, uy, gross, f, seite * 2 + a);
    g.strokeStyle = aermel;
    g.lineWidth = E * 0.24;
    g.beginPath();
    g.moveTo(sx, sy);
    g.lineTo(hx - ux * E * 0.1, hy - uy * E * 0.1);
    g.stroke();
    g.fillStyle = hand;
    g.beginPath();
    g.arc(hx, hy, E * 0.13, 0, TAU);
    g.fill();
  }

  /*
   * Der Kapitän: blauer Rock mit goldenen Knöpfen, weisser Bart, Mütze. Den
   * roten Wimpel hält er in der rechten Hand – von vorn gesehen links im
   * Bild. Dreht er sich um, wird das ganze Bild gespiegelt (dreh von 1 über
   * 0 nach −1), und von hinten hat der Rock eine Naht statt der Knöpfe.
   */
  function zeichneKapitaen() {
    const st = state;
    const E = view.e;
    const cx = view.cx;
    const ky = view.ky;
    // Die Kehrtwende: dreh ist der Kosinus des Winkels.
    const k = clamp((st.tick - st.drehSeit) / DREH, 0, 1);
    const weich = k * k * (3 - 2 * k);
    const winkel = (st.umgedreht ? weich : 1 - weich) * Math.PI;
    const dreh = st.phase === "bereit" ? 1 : Math.cos(st.drehSeit < -999 ? 0 : winkel);
    const vorn = dreh >= 0;
    const wippen = ruhig() ? 0 : Math.sin(st.echt * 1.6) * E * 0.012;
    const zornig = st.fehler ? clamp((st.echt - st.bild.fehler) / 0.2, 0, 1) : 0;
    g.save();
    g.translate(cx, ky + wippen);
    g.scale(Math.abs(dreh) < 0.06 ? 0.06 * (dreh < 0 ? -1 : 1) : dreh, 1);
    g.lineCap = "round";
    g.lineJoin = "round";
    // Die Beine und Stiefel.
    g.fillStyle = "#16203f";
    g.fillRect(-E * 0.36, -E * 1.0, E * 0.3, E * 0.9);
    g.fillRect(E * 0.06, -E * 1.0, E * 0.3, E * 0.9);
    g.fillStyle = "#15120f";
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(s * E * 0.23, -E * 0.06, E * 0.24, E * 0.11, 0, 0, TAU);
      g.fill();
    }
    // Die Arme: hinter dem Rock angesetzt, mit Stock und Flagge.
    zeichneArm(-E * 0.5, -E * 1.86, -1, armKapitaen(0), 1, ROT, "#1d2c55", "#f0c39a");
    zeichneArm(E * 0.5, -E * 1.86, 1, armKapitaen(1), 1, GELB, "#1d2c55", "#f0c39a");
    // Der Rock.
    g.fillStyle = "#1d2c55";
    g.beginPath();
    g.moveTo(-E * 0.52, -E * 2.04);
    g.quadraticCurveTo(0, -E * 2.16, E * 0.52, -E * 2.04);
    g.lineTo(E * 0.6, -E * 0.8);
    g.lineTo(-E * 0.6, -E * 0.8);
    g.closePath();
    g.fill();
    if (vorn) {
      // Revers, zwei Reihen Knöpfe, Tressen am Ärmel.
      g.fillStyle = "#253769";
      g.beginPath();
      g.moveTo(-E * 0.16, -E * 2.06);
      g.lineTo(0, -E * 1.6);
      g.lineTo(E * 0.16, -E * 2.06);
      g.closePath();
      g.fill();
      g.fillStyle = "#f5f1e6";
      g.beginPath();
      g.moveTo(-E * 0.09, -E * 2.07);
      g.lineTo(0, -E * 1.84);
      g.lineTo(E * 0.09, -E * 2.07);
      g.closePath();
      g.fill();
      g.fillStyle = "#ffd23f";
      for (let i = 0; i < 4; i += 1) {
        for (const s of [-1, 1]) {
          g.beginPath();
          g.arc(s * E * 0.17, -E * (1.52 - i * 0.2), E * 0.045, 0, TAU);
          g.fill();
        }
      }
    } else {
      // Von hinten: die Naht und der Riegel.
      g.strokeStyle = "#141f40";
      g.lineWidth = Math.max(1.5, E * 0.03);
      g.beginPath();
      g.moveTo(0, -E * 2.08);
      g.lineTo(0, -E * 0.82);
      g.stroke();
      g.fillStyle = "#141f40";
      g.fillRect(-E * 0.3, -E * 1.36, E * 0.6, E * 0.1);
      g.fillStyle = "#ffd23f";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(s * E * 0.26, -E * 1.31, E * 0.04, 0, TAU);
        g.fill();
      }
    }
    // Der Kopf.
    const kopfY = -E * 2.42;
    g.fillStyle = "#f0c39a";
    g.beginPath();
    g.arc(0, kopfY, E * 0.3, 0, TAU);
    g.fill();
    if (vorn) {
      // Der Bart, die Augen unter buschigen Brauen, die Pfeife im Mund.
      g.fillStyle = "#f5f1e6";
      g.beginPath();
      g.arc(0, kopfY + E * 0.03, E * 0.31, 0.02 * Math.PI, 0.98 * Math.PI);
      g.quadraticCurveTo(0, kopfY + E * 0.62, E * 0.31, kopfY + E * 0.05);
      g.fill();
      g.fillStyle = "#f0c39a";
      g.beginPath();
      g.ellipse(0, kopfY + E * 0.06, E * 0.12, E * 0.05, 0, 0, TAU);
      g.fill();
      g.fillStyle = "#1c1a16";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.arc(s * E * 0.11, kopfY - E * 0.05, E * 0.032, 0, TAU);
        g.fill();
      }
      g.strokeStyle = "#f5f1e6";
      g.lineWidth = E * 0.05;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * E * 0.05, kopfY - E * (0.12 - 0.05 * zornig));
        g.lineTo(s * E * 0.18, kopfY - E * (0.13 + 0.04 * zornig));
        g.stroke();
      }
      // Die Trillerpfeife: beim Kommando im Mund.
      const pfiff = clamp(1 - (st.echt - st.bild.kommando) / 0.25, 0, 1);
      if (pfiff > 0) {
        g.fillStyle = "#c9ccd6";
        g.beginPath();
        g.ellipse(E * 0.04, kopfY + E * 0.12, E * 0.09, E * 0.05, 0, 0, TAU);
        g.fill();
      }
    } else {
      // Von hinten: kein Gesicht, nur weisses Haar und zwei Ohren.
      g.fillStyle = "#f0c39a";
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(s * E * 0.3, kopfY + E * 0.03, E * 0.05, E * 0.08, 0, 0, TAU);
        g.fill();
      }
      g.fillStyle = "#e9e4d6";
      g.beginPath();
      g.arc(0, kopfY, E * 0.305, 0, TAU);
      g.fill();
      g.strokeStyle = "#c9c2b0";
      g.lineWidth = Math.max(1, E * 0.02);
      for (let i = -2; i <= 2; i += 1) {
        g.beginPath();
        g.moveTo(i * E * 0.09, kopfY - E * 0.08);
        g.quadraticCurveTo(i * E * 0.11, kopfY + E * 0.1, i * E * 0.08, kopfY + E * 0.27);
        g.stroke();
      }
    }
    // Die Mütze.
    g.fillStyle = "#f5f1e6";
    g.beginPath();
    g.ellipse(0, kopfY - E * 0.27, E * 0.4, E * 0.16, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#16203f";
    g.fillRect(-E * 0.31, kopfY - E * 0.26, E * 0.62, E * 0.12);
    if (vorn) {
      g.fillStyle = "#15120f";
      g.beginPath();
      g.ellipse(0, kopfY - E * 0.13, E * 0.3, E * 0.06, 0, 0, Math.PI);
      g.fill();
      g.fillStyle = "#ffd23f";
      g.beginPath();
      g.arc(0, kopfY - E * 0.21, E * 0.055, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  /*
   * Wer spielt: ein Matrose von hinten, unten in der Mitte – gestreiftes
   * Hemd, Kragen, Mütze mit Bommel. Der rote Wimpel links, die gelbe Fahne
   * rechts, immer.
   */
  function zeichneMatrose() {
    const st = state;
    const E = view.e;
    const M = 0.62;
    const e = E * M;
    const cx = view.cx;
    const fy = view.cssH + e * 0.15;
    const nass = st.fehler ? clamp((st.echt - st.bild.fehler) / 0.3, 0, 1) : 0;
    const armWert = (h) => {
      const zielWert = st.pose & bit(h) ? 1 : 0;
      const k = clamp((st.echt - st.bild.arm[h]) / 0.07, 0, 1);
      return lerp(1 - zielWert, zielWert, 1 - (1 - k) * (1 - k));
    };
    g.save();
    g.translate(cx, fy + nass * e * 0.25);
    g.lineCap = "round";
    g.lineJoin = "round";
    zeichneArmUm(-e * 0.5, -e * 1.5, -1, armWert(0), M, ROT);
    zeichneArmUm(e * 0.5, -e * 1.5, 1, armWert(1), M, GELB);
    // Das Hemd: weiss mit blauen Streifen.
    g.fillStyle = "#f5f1e6";
    g.beginPath();
    g.moveTo(-e * 0.56, -e * 1.66);
    g.quadraticCurveTo(0, -e * 1.8, e * 0.56, -e * 1.66);
    g.lineTo(e * 0.6, 0);
    g.lineTo(-e * 0.6, 0);
    g.closePath();
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = "#2a5db0";
    g.lineWidth = e * 0.1;
    for (let i = 0; i < 9; i += 1) {
      g.beginPath();
      g.moveTo(-e * 0.7, -e * (1.5 - i * 0.22));
      g.lineTo(e * 0.7, -e * (1.5 - i * 0.22));
      g.stroke();
    }
    g.restore();
    // Der Kragen.
    g.fillStyle = "#1d3f86";
    g.beginPath();
    g.moveTo(-e * 0.42, -e * 1.72);
    g.lineTo(e * 0.42, -e * 1.72);
    g.lineTo(e * 0.38, -e * 1.2);
    g.lineTo(-e * 0.38, -e * 1.2);
    g.closePath();
    g.fill();
    g.strokeStyle = "#f5f1e6";
    g.lineWidth = Math.max(1, e * 0.035);
    g.strokeRect(-e * 0.32, -e * 1.66, e * 0.64, e * 0.4);
    // Der Kopf von hinten, die Mütze mit Bommel.
    g.fillStyle = "#f0c39a";
    g.beginPath();
    g.arc(0, -e * 2.02, e * 0.3, 0, TAU);
    g.fill();
    g.fillStyle = "#6b4426";
    g.beginPath();
    g.arc(0, -e * 2.04, e * 0.31, 0.95 * Math.PI, 2.05 * Math.PI);
    g.quadraticCurveTo(0, -e * 1.86, -e * 0.31, -e * 2.0);
    g.fill();
    g.fillStyle = "#f5f1e6";
    g.beginPath();
    g.ellipse(0, -e * 2.3, e * 0.38, e * 0.15, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#1d3f86";
    g.fillRect(-e * 0.31, -e * 2.3, e * 0.62, e * 0.1);
    g.fillStyle = "#e23b2e";
    g.beginPath();
    g.arc(0, -e * 2.46, e * 0.08, 0, TAU);
    g.fill();
    g.restore();
  }
  // Der Arm des Matrosen: im Bild schon verschoben (translate).
  function zeichneArmUm(sx, sy, seite, a, gross, f) {
    zeichneArm(sx, sy, seite, a, gross, f, "#f5f1e6", "#f0c39a");
  }

  // Die zwei Knöpfe unten: links der rote Wimpel, rechts die gelbe Fahne.
  // Gedrückt wird die ganze Hälfte; die Knöpfe zeigen nur, wo.
  function zeichneKnoepfe() {
    const st = state;
    const E = view.e;
    const r = clamp(E * 0.52, 26, 46);
    const y = view.cssH - r - 14;
    g.save();
    for (const h of [0, 1]) {
      const x = h === 0 ? r + 14 : view.cssW - r - 14;
      const an = Boolean(st.pose & bit(h));
      const puls = st.phase === "bereit" && !ruhig() ? 0.5 + 0.5 * Math.sin(state.echt * 4.5 + h * Math.PI) : 0;
      g.globalAlpha = an ? 0.95 : 0.55 + 0.3 * puls;
      g.fillStyle = "rgba(14, 18, 34, 0.55)";
      g.beginPath();
      g.arc(x, y, r * (an ? 0.94 : 1 + 0.06 * puls), 0, TAU);
      g.fill();
      g.lineWidth = an ? 4 : 2;
      g.strokeStyle = h === 0 ? "#ff6b5e" : "#ffd23f";
      g.stroke();
      // Das Zeichen: Wimpel oder Fahne am Stock.
      g.strokeStyle = "#f1e6cc";
      g.lineWidth = Math.max(2, r * 0.07);
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(x - r * 0.28, y + r * 0.45);
      g.lineTo(x - r * 0.28, y - r * 0.45);
      g.stroke();
      g.fillStyle = h === 0 ? "#e23b2e" : "#ffd23f";
      g.beginPath();
      if (h === 0) {
        g.moveTo(x - r * 0.24, y - r * 0.44);
        g.lineTo(x + r * 0.42, y - r * 0.2);
        g.lineTo(x - r * 0.24, y + r * 0.04);
      } else {
        g.rect(x - r * 0.24, y - r * 0.44, r * 0.6, r * 0.46);
      }
      g.closePath();
      g.fill();
      if (h === 1) {
        g.fillStyle = "#1c1a16";
        g.beginPath();
        g.arc(x + r * 0.06, y - r * 0.21, r * 0.09, 0, TAU);
        g.fill();
      }
    }
    g.restore();
  }

  function zeichneTeile() {
    const E = view.e;
    g.save();
    g.fillStyle = "#e8f6ff";
    for (const t of state.teile) {
      const k = clamp(t.leben / t.max, 0, 1);
      g.globalAlpha = Math.min(0.9, k * 1.6);
      g.beginPath();
      g.arc(view.cx + t.x * E, view.ky + t.y * E, t.r * E * (0.6 + k), 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function zeichneSchriften() {
    const E = view.e;
    g.save();
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const t of state.schriften) {
      const k = clamp(t.leben / t.max, 0, 1);
      const gross = clamp(t.gross * E / 80, t.gross * 0.8, t.gross * 1.5);
      const X = clamp(view.cx + t.x * E, 90, view.cssW - 90);
      const Y = clamp(view.ky + t.y * E - (1 - k) * 18, view.frei + 40, view.cssH - 30);
      g.globalAlpha = Math.min(1, k * 3);
      g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(10, 16, 30, 0.85)";
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

  // Oben links, unter den Knöpfen: die Punkte, die Welle, die Blitze in Folge.
  function zeichneAnzeige() {
    if (state.phase === "bereit") return;
    const st = state;
    g.save();
    g.translate(0, view.frei);
    const gross = Math.round(clamp(view.cssH * 0.05, 14, 24));
    const klein = Math.round(gross * 0.6);
    const x = 12;
    let y = 12;
    y += pille(`${st.punkte}`, x, y, gross, "rgba(10, 16, 30, 0.62)", "#ffffff") + 6;
    y += pille(`Welle ${welleJetzt() + 1}${st.umgedreht ? " · Kehrt" : ""}`, x, y, klein, "rgba(255, 210, 63, 0.92)", "#2a1d00") + 5;
    if (st.kette > 0) pille(`Blitz ×${st.kette}`, x, y, klein, "rgba(10, 16, 30, 0.55)", "#ffd23f");
    g.restore();
  }

  // Die Ansage einer neuen Welle: gross über dem Kapitän, kurz.
  function zeichneAnsage() {
    const a = state.ansage;
    if (!a) return;
    const t = state.echt - a.seit;
    const k = clamp(t / 0.18, 0, 1) * clamp((1.6 - t) / 0.4, 0, 1);
    const gross = Math.round(clamp(view.e * 0.46, 20, 42));
    const Y = Math.max(view.frei + gross * 1.9, view.ky - view.e * 4.3);
    g.save();
    g.globalAlpha = k;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.lineWidth = gross * 0.2;
    g.lineJoin = "round";
    g.strokeStyle = "rgba(10, 16, 30, 0.85)";
    g.strokeText(a.text, view.cx, Y);
    g.fillStyle = "#ffd23f";
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
    const seitFehler = state.echt - state.bild.fehler;
    const stoss = !ruhig() && seitFehler < 0.4 ? Math.sin(seitFehler * 60) * 6 * (1 - seitFehler / 0.4) : 0;
    g.setTransform(view.dpr, 0, 0, view.dpr, stoss * view.dpr, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.fillStyle = "#16203f";
    g.fillRect(-20, 0, view.cssW + 40, view.cssH);
    zeichneWelt();
    zeichneMast();
    zeichneKapitaen();
    zeichneDeck();
    zeichneMatrose();
    zeichneRegen();
    zeichneTeile();
    zeichneKnoepfe();
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
  // sie höchstens AUFHOLEN_MAX Schritte auf; der Rest fällt weg – die Frist
  // steht dann einen Augenblick still, statt ungesehen abzulaufen.
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
  // gemeinsamen Start (game-shell.js, live.los). Eine Sekunde später kommt
  // das erste Kommando.
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

  // Eine Seite drücken (runter) oder loslassen – vom Finger, von der Taste
  // oder aus den Prüfskripten. Der erste Tipp startet nur: Flaggen gibt es
  // ab dem zweiten.
  function hand(h, runter) {
    if (state.phase === "zuschauen" || state.phase === "ende") return;
    if (state.phase === "bereit") {
      if (runter && !shell.live) losGehts();
      return;
    }
    if (state.phase !== "spiel") return;
    eingabe(h, runter);
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
    state.plan = { kommandos: [], wellen: 0, letzte: 0 };
    planBis(12 * WELLE);
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
    gedrueckt.clear();
    tastenUnten[0].clear();
    tastenUnten[1].clear();
    shell.setCount(0);
    gegner?.runde();

    shell.clear();
    const prompt = shell.el("p", "cm-prompt fk-prompt", "Zeig, was der Kapitän zeigt: links halten hebt den roten Wimpel, rechts die gelbe Fahne.");
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

  const GRUND_KURZ = { falsch: "Falsche Flagge!", gesenkt: "Zu früh gesenkt!", langsam: "Zu langsam!" };
  const GRUND = {
    falsch: "Eine Flagge gehoben, die er nicht zeigte",
    gesenkt: "Eine Flagge gesenkt, die er noch zeigte",
    langsam: "Die Frist war um",
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
    const kommandos = state.kommandos === 1 ? "1 Kommando" : `${state.kommandos} Kommandos`;
    const teile = [
      kommandos,
      state.blitze ? `${state.blitze} Blitz` : "",
      GRUND[state.fehler?.grund] || "",
      vorher ? `Bestwert ${vorher}` : "",
    ];
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? `Neuer Rekord! ${kommandos}` : teile.filter(Boolean).join(" · "),
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("fk-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Getippt wird auf der ganzen Bühne: die linke Hälfte für den roten Wimpel,
  // die rechte für die gelbe Fahne – jeder Finger für sich. Eine Seite ist
  // gedrückt, solange ein Finger auf ihr liegt.
  const gedrueckt = new Map();
  const tastenUnten = [new Set(), new Set()];
  const zaehle = (h) => [...gedrueckt.values()].filter((x) => x === h).length + tastenUnten[h].size;

  shell = shellApi.mount({
    host,
    title: "Flaggenkommando",
    area: "konzentration",
    accent: "#00A5B5",
    accentDark: "#00707c",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); }, halten: true },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "flagCommand", fassung: "z1", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "flagCommand", host, art: "ziel" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;
  }

  function seiteBei(clientX) {
    const r = host.getBoundingClientRect();
    return clientX < r.left + r.width / 2 ? 0 : 1;
  }

  // Vor dem Druck holt die Runde bis jetzt auf: Er gilt in dem Schritt, in
  // dem der Finger kam, nicht im letzten Bild.
  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    const h = seiteBei(event.clientX);
    const vorher = zaehle(h);
    gedrueckt.set(event.pointerId, h);
    if (vorher > 0) return;
    aufholen();
    hand(h, true);
  });
  const fingerWeg = (event) => {
    if (!gedrueckt.has(event.pointerId)) return;
    const h = gedrueckt.get(event.pointerId);
    gedrueckt.delete(event.pointerId);
    if (zaehle(h) > 0) return;
    aufholen();
    hand(h, false);
  };
  window.addEventListener("pointerup", fingerWeg);
  window.addEventListener("pointercancel", fingerWeg);

  // A oder Pfeil links für den roten Wimpel, L, D oder Pfeil rechts für die
  // gelbe Fahne. Leertaste und Enter starten nur. Steht der Fokus auf einem
  // Knopf, gilt die Taste dem Knopf.
  const TASTEN_LINKS = new Set(["KeyA", "ArrowLeft"]);
  const TASTEN_RECHTS = new Set(["KeyL", "KeyD", "ArrowRight"]);
  document.addEventListener("keydown", (event) => {
    const links = TASTEN_LINKS.has(event.code) || event.key === "ArrowLeft";
    const rechts = TASTEN_RECHTS.has(event.code) || event.key === "ArrowRight";
    const start = event.key === " " || event.key === "Enter";
    if (!links && !rechts && !start) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (start) {
      if (state.phase === "bereit" && !shell.live) losGehts();
      return;
    }
    const h = links ? 0 : 1;
    const vorher = zaehle(h);
    tastenUnten[h].add(event.code || event.key);
    if (vorher > 0) return;
    aufholen();
    hand(h, true);
  });
  document.addEventListener("keyup", (event) => {
    const code = event.code || event.key;
    for (const h of [0, 1]) {
      if (!tastenUnten[h].has(code)) continue;
      tastenUnten[h].delete(code);
      if (zaehle(h) > 0) continue;
      aufholen();
      hand(h, false);
    }
  });
  // Wer das Fenster verlässt, lässt alles los.
  window.addEventListener("blur", () => {
    for (const h of [0, 1]) {
      const war = zaehle(h) > 0;
      tastenUnten[h].clear();
      for (const [id, x] of [...gedrueckt]) if (x === h) gedrueckt.delete(id);
      if (war) hand(h, false);
    }
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); klangAus(); });

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // Für die Prüfskripte und die Vorführung: der Zustand, ein Schritt ohne
  // Bild (takt), Drücken und Loslassen (druecke(0|1), loslassen(0|1)), die
  // Frist einer Welle (fristBei) und die Welt (weltText, kommandoBei).
  window.LernappFlaggen = {
    HZ, TAKT, ROT, GELB, WELLE, BLITZ, KETTE_MAX, ENDE_AB, BEIDE_AB, FINTE_AB, KEHRT_AB, DREH, FINTE_DAUER,
    state, view, takt, zeichnen, losGehts,
    druecke: (h) => hand(h, true),
    loslassen: (h) => hand(h, false),
    fristBei, pauseBei, kommandoBei, planBis, weltText, armKapitaen,
    zugProtokoll: () => zugProtokoll.slice(),
    // Zuschauen mit einer eigenen Quelle – wie live.zuschauen im Multiplayer.
    zuschauenMit(quelle) { zuschauer = quelle; zuschauenStarten(); },
  };
})();
