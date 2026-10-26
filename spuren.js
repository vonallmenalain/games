/*
 * spuren.js – Zwei Spuren.
 * ---------------------------------------------------------------------------
 * Zwei Bobs fahren nebeneinander durch zwei Eiskanäle, links der rote, rechts
 * der blaue. Jeder Kanal hat zwei Spuren. Ein Tipp auf die linke Bildhälfte
 * lässt den roten Bob die Spur wechseln, ein Tipp auf die rechte den blauen –
 * mit zwei Fingern auch beide zugleich. Am Rechner: A oder Pfeil links, L
 * oder Pfeil rechts.
 *
 * Von oben kommen in jedem Kanal Dinge entgegen: Tannen, Steine und
 * Schneemänner, denen man ausweicht, und Sterne, die man einsammelt. Ein
 * Hindernis getroffen – vorbei. Einen Stern verpasst – auch vorbei. Darum
 * müssen immer beide Kanäle im Blick bleiben: Wer nur auf einen schaut,
 * verpasst im anderen den Stern.
 *
 * Gezählt werden die Sterne. Kommt in beiden Kanälen auf derselben Höhe
 * etwas, das beide zum Wechseln zwingt (ein Doppeltipp), gibt es einen Punkt
 * dazu. Das Tempo steigt mit der Strecke, die Muster werden dichter: erst
 * abwechselnd links und rechts, dann Doppeltipps, Tore aus Stern und
 * Hindernis, schnelle Wechsel in einem Kanal, während im anderen Sterne
 * kommen, und gegenläufiges Zickzack in beiden.
 *
 * Die Welt kommt aus dem Zufall (zufall.js), Reihe für Reihe in fester
 * Folge – im Turnier hat jeder dieselben Reihen. Sie ist immer fahrbar: Zwei
 * Dinge, die im selben Kanal verschiedene Spuren verlangen, liegen so weit
 * auseinander, dass der Wechsel (eine Achtelsekunde) und ein Fenster für den
 * Tipp dazwischen passen; das Fenster wird mit dem Tempo kleiner, aber nie
 * kleiner als eine Sechstelsekunde.
 *
 * Gerechnet wird in festen Schritten (TAKT, 240 je Sekunde), und alles, was
 * zählt, ist ganzzahlig: Ein Spurwechsel dauert genau K Schritte, und die
 * Lage eines Bobs ist ein Zähler k von 0 bis K. Ein Spurwechsel ist ein Zug
 * (geist.js, zuege; live-spiel.js, zug) mit dem Schritt, in dem er geschah,
 * und beiden Zielspuren. Beim Zuschauen (Hall of Fame und Multiplayer) baut
 * die Saat dieselbe Welt, und jeder Wechsel kommt im selben Schritt – so
 * fährt die Wiedergabe genau dieselbe Fahrt, Stern für Stern. Das Ende kommt
 * dort mit seinem eigenen Zug (was getroffen oder verpasst wurde).
 *
 * Gegner: wie in Blätter im Strom als Tempo (geist.js, art "tempo") – die
 * Schalter oben zeigen, wie viele Sterne Platz 1 und die eigene Bestmarke zu
 * dieser Zeit hatten. Standardmässig sind sie aus; das Spiel braucht sie
 * nicht.
 *
 * Gezeichnet wird auf eine Leinwand, von oben: Schneefeld, die zwei
 * Eiskanäle mit roten und blauen Wänden, Tannen am Rand, die schneller
 * vorbeiziehen als der Boden (Parallaxe), Wolkenschatten, Schneefall,
 * Schneestaub hinter den Kufen, Kratzspuren im Eis und Tempostriche. Was sich
 * nicht bewegt, ist einmal je Bildgrösse vorgemalt (vorrendern).
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "lanes") return;

  const host = document.querySelector("#zs-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  // Wer weniger Bewegung eingestellt hat, bekommt keinen Stoss aufs Bild,
  // weniger Schneestaub, keine Tempostriche und einen kleineren Zoom beim
  // Fehler. Die Bobs fahren trotzdem – das ist das Spiel.
  const ruhig = () => Boolean(kids()?.prefersReducedMotion?.());
  const klang = () => window.ArcadeKlang || null;

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; im Turnier
  // und im Live-Modus bekommt jeder dieselben Reihen (zufall.js). Nur die
  // Reihen ziehen daraus – Schneestaub, Funken und Flocken würfeln
  // Math.random oder hängen an einer festen Zahl (hash01).
  const zufall = window.LernappZufall?.fuer?.("twinLanes") || { neu() {}, zahl: () => Math.random() };

  // ---------------------------------------------------------------------------
  // Die Welt
  // ---------------------------------------------------------------------------
  // In Einheiten. x zählt von der Mitte zwischen den Kanälen nach rechts, y
  // die Strecke den Hang hinunter. Im Bild liegt «voraus» oben: Die Dinge
  // kommen von oben, die Bobs stehen unten und fahren nach oben ins Bild.
  const TAKT = 1 / 240;            // ein Schritt der Rechnung
  const SPUR = 36;                 // so breit ist eine Spur
  const MITTE = 34;                // zwischen den Eisböden: zwei Innenwände und der Schneerücken
  const WAND = 9;
  const BODEN_AUSSEN = MITTE / 2 + SPUR * 2;   // hier endet ein Eisboden aussen
  const RAND = BODEN_AUSSEN + WAND;            // Aussenkante der Aussenwand
  const WELT_W = 216;              // so breit ist das Bild mindestens
  const SICHT_H = 340;             // so viel Strecke steht mindestens untereinander im Bild
  const SCHLITTEN_AN = 0.8;        // so weit unten im Bild fahren die Bobs
  const KACHEL = 480;              // so lang ist der vorgemalte Boden, dann wiederholt er sich

  // Die Bobs und was sie trifft.
  const K = 30;                    // so viele Schritte dauert ein Spurwechsel (1/8 s)
  const HALB_B = 8;                // halbe Breite eines Bobs, wie er getroffen wird
  const HALB_L = 13;               // halbe Länge
  const HINDERNIS_R = 11;
  const TREFF_X = HALB_B + HINDERNIS_R;
  const TREFF_L = HALB_L + HINDERNIS_R;
  const STERN_X = 22;              // so nah muss die Mitte des Bobs am Stern sein
  const STERN_L = 22;
  const KNAPP_X = 26;              // so nah an einem Hindernis vorbei ist «knapp»

  // Tempo und Schwere hängen an der Strecke, nicht an der Uhr: Wer gleich weit
  // kommt, war gleich schnell. Nach einer halben Minute ist es schwer, nach
  // anderthalb Minuten fast so schwer, wie es wird.
  const V0 = 150;
  const VMAX = 350;
  const V_WEG = 14000;
  const K_WEG = 7000;
  const VORLAUF = 320;             // hier liegt die erste Reihe
  const AUFHOLEN_MAX = 30;         // so viele Schritte holt ein Bild höchstens auf
  const ENDE_MS = 1100;            // vom Fehler bis zur Tafel
  const TEILE_MAX = 260;
  const SPUR_N = 56;               // so viele Proben hat die Kratzspur hinter einem Bob
  const SPUR_ABST = 5;
  const TOP_COUNT = 5;

  // Die Züge (meldeZug): c sagt, was geschah.
  const ZUG_START = 0;
  const ZUG_WECHSEL = 1;
  // Ab 2: das Ende – 2 und 3 ein Hindernis links und rechts, 4 und 5 ein
  // verpasster Stern links und rechts; darüber, welches Ding es war (× 8).
  const ZUG_HINDERNIS = 2;
  const ZUG_STERN = 4;

  const TAU = Math.PI * 2;
  const NAMEN = { tanne: "Tanne", stein: "Stein", mann: "Schneemann", stern: "Stern" };

  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.spuren", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  const lerp = (a, b, k) => a + (b - a) * k;
  const glatt = (u) => u * u * (3 - 2 * u);
  const raus = (k) => 1 - (1 - k) * (1 - k) * (1 - k);

  // Immer dieselbe Zahl zu derselben Eingabe: Bäume, Steine und Glitzern
  // stehen bei jedem Bild am selben Platz, ohne den Zufall der Reihen
  // anzufassen.
  function hash01(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  const tempoBei = (y) => V0 + (VMAX - V0) * (1 - Math.exp(-Math.max(0, y) / V_WEG));
  const schwereBei = (y) => 1 - Math.exp(-Math.max(0, y) / K_WEG);
  // Ein Schlag: der Abstand der Reihen, in Zeit erst knapp eine Sekunde,
  // zuletzt gut vier Zehntel. In Einheiten bleibt er fast gleich – das Bild
  // wird nicht voller, nur schneller.
  const schlagBei = (y) => lerp(0.95, 0.42, schwereBei(y)) * tempoBei(y);
  // So weit liegen zwei Dinge im selben Kanal mindestens auseinander, wenn sie
  // verschiedene Spuren verlangen: beide Fenster, in denen sie treffen, und
  // dazwischen Zeit für den Tipp – anfangs eine halbe Sekunde, zuletzt eine
  // Sechstelsekunde.
  const abstandBei = (y) => 2 * TREFF_L + 2 + tempoBei(y) * lerp(0.5, 0.17, schwereBei(y));
  // Die Mitte einer Spur: u = 0 die linke, u = 1 die rechte Spur des Kanals.
  const spurX = (bahn, u) => (bahn === 0 ? -BODEN_AUSSEN : MITTE / 2) + SPUR * (0.5 + u);

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  // phase: "bereit"    die Bobs stehen am Start, noch ist nichts getippt
  //        "spiel"     die Fahrt läuft
  //        "ende"      ein Fehler, Zeitlupe, gleich kommt die Tafel
  //        "zuschauen" die Fahrt eines anderen, Zug um Zug
  function neuerSchlitten(bahn) {
    const ziel = bahn === 0 ? 0 : 1;
    return {
      bahn,
      ziel,                       // die Spur, in die er fährt (0 links, 1 rechts im Kanal)
      k: ziel * K,                // wo er ist: 0 links, K rechts
      wechselTick: -1e9,
      // Nur fürs Bild:
      neig: 0, quetsch: 0, wackel: 0, warBewegt: false,
      crash: false, dreh: 0, drehZiel: 0, rueck: 0, rueckV: 0,
      staub: 0, spruehen: 0,
      spur: new Float32Array(SPUR_N), spurI: 0, spurN: 0, spurY: 0,
      fuellung: null,
    };
  }

  const state = {
    phase: "bereit",
    tick: 0,
    weg: 0,
    punkte: 0,
    sterne: 0,
    doppel: 0,
    losMs: 0,
    uhrRest: 0,
    schlitten: [neuerSchlitten(0), neuerSchlitten(1)],
    plan: null,
    dinge: [],
    erstes: 0,
    zeilen: [],
    fehler: null,
    fertig: false,
    zeit: 0,
    lupe: 1,
    stoss: 0,
    puls: 0,
    glanz: 0,
    schriften: [],
  };

  let shell = null;
  let feld = null;
  let canvas = null;
  let g = null;
  let prompt = null;
  let tipps = [];
  let frame = null;
  let last = 0;
  let stepTimer = null;
  let gezeigt = -1;
  // Die Gegner (geist.js): Platz 1 und die eigene Bestmarke fahren als Zahl
  // mit – wie viele Sterne sie zu dieser Zeit hatten.
  let gegner = null;
  // Die Aufzeichnung der Züge (geist.js, zuege) und wer gerade eine Fahrt
  // anschaut (geist.js, zuschauer – oder im Multiplayer die Quelle des
  // anderen).
  let aufnahme = null;
  let zuschauer = null;
  let gesehenBis = -Infinity;
  let zugListe = [];
  let zugNaechster = 0;
  let zugAnker = -1;

  const view = { s: 1, dpr: 1, cssW: 0, cssH: 0, frei: 0, mx: 0, sy: 0, vorn: 300, hinten: 80, halb: 120 };
  const cam = { z: 1, ex: 0, ey: 0 };
  const bilder = {};

  // Beim Anschauen fährt dieses Gerät nur nach – es klingt wie im Spiel,
  // aber es brummt nicht.
  const zuschauend = () => state.phase === "zuschauen";
  const brumm = (muster) => { if (!zuschauend()) kids()?.vibrate?.(muster); };

  // Die Kufen auf dem Eis (klang.js), solange die Bobs fahren – schneller mit
  // dem Tempo. Nachgestellt höchstens alle 50 ms: Die Kulisse gleitet
  // ohnehin, und die Prüfskripte rechnen viele Schritte am Stück.
  let kufen = null;
  let kufenGestellt = -1e9;
  function kufenAn() {
    if (!kufen?.laeuft) kufen = klang()?.kulisse("spuren.kufen") || null;
    kufenStellen(true);
  }
  function kufenAus() {
    kufen?.stop();
    kufen = null;
  }
  function kufenStellen(sofort = false) {
    if (!kufen?.laeuft) return;
    const jetzt = performance.now();
    if (!sofort && jetzt - kufenGestellt < 50) return;
    kufenGestellt = jetzt;
    kufen.setze(0.2 + 0.8 * clamp((tempoBei(state.weg) - V0) / (VMAX - V0), 0, 1));
  }
  // Was dicht kommen kann (zwei Wechsel zugleich, zwei Sterne in einer
  // Reihe, das Aufholen beim Zuschauen), klingt höchstens alle 60 ms.
  const tonZuletzt = {};
  function tonMitPause(id, o) {
    const jetzt = performance.now();
    if (jetzt - (tonZuletzt[id] ?? -1e9) < 60) return;
    tonZuletzt[id] = jetzt;
    klang()?.ton(id, o);
  }
  // Doppeltipps in Folge – Reihe um Reihe – sind eine Serie.
  let doppelReihe = 0;
  let doppelZeile = -9;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  function stopLoop() {
    if (frame) { window.cancelAnimationFrame(frame); frame = null; }
  }

  // ---------------------------------------------------------------------------
  // Die Reihen
  // ---------------------------------------------------------------------------
  /*
   * Gewürfelt wird in Mustern: Jedes ist eine kurze Folge von Reihen, jede
   * Reihe sagt für jeden Kanal, was dort kommt –
   *
   *   "s"   ein Stern in der Spur, in der der Bob ohnehin ist
   *   "sw"  ein Stern in der anderen Spur (wechseln!)
   *   "hw"  ein Hindernis in der Spur, in der er ist (wechseln!)
   *   "w"   wechseln – mit einem Stern drüben oder einem Hindernis hier
   *   "b"   bleiben – mit einem Stern hier oder einem Hindernis drüben
   *   "t"   ein Tor: Stern und Hindernis nebeneinander, bleiben
   *   "tw"  ein Tor, wechseln
   *
   * und s, wie viele Schläge nach der vorigen Reihe sie kommt. Was ein Kanal
   * verlangt, merkt sich der Plan (soll); verlangt eine Reihe einen Wechsel,
   * der so kurz nach dem letzten Ding im Kanal nicht zu schaffen wäre
   * (abstandBei), wird daraus ein Bleiben. So ist jede Welt fahrbar.
   */
  const reihe = (s, L, R) => ({ s, L: L || null, R: R || null });
  const inBahn = (s, bahn, was, anderes = null) => (bahn === 0 ? reihe(s, was, anderes) : reihe(s, anderes, was));

  // Der Anfang ist für alle gleich und ruhig: ein Stern links, einer rechts,
  // dann muss links einem Hindernis ausgewichen und rechts für einen Stern
  // gewechselt werden.
  function einstieg() {
    return [
      reihe(0, "s"), reihe(0.5, null, "s"), reihe(1, "hw"), reihe(0.5, null, "sw"),
      reihe(0.5, "s"), reihe(0.5, null, "s"),
    ];
  }

  function neuerPlan() {
    return {
      y: 0, erste: true, soll: [0, 1], letztY: [-1e9, -1e9],
      muster: einstieg(), zuletzt: "einstieg", reihen: 0, dinge: 0,
    };
  }

  function musterWaehlen() {
    const p = state.plan;
    const k = schwereBei(p.y);
    const r = () => zufall.zahl();
    const anzahl = (a, b) => a + Math.floor(r() * (b - a + 1));
    const ps = lerp(0.35, 0.65, k);
    const arten = [
      ["wechselweise", 3],
      ["doppel", k < 0.12 ? 0 : lerp(0.7, 2.2, k)],
      ["tore", k < 0.2 ? 0 : 1],
      ["slalom", k < 0.3 ? 0 : lerp(0.4, 1.6, k)],
      ["gegen", k < 0.45 ? 0 : lerp(0.4, 1.6, k)],
      ["sterne", 0.5],
    ];
    // Dasselbe Muster nicht zweimal hintereinander – ausser dem einfachsten.
    const gewicht = ([name, w]) => (name === p.zuletzt && name !== "wechselweise" ? 0 : w);
    let summe = 0;
    arten.forEach((a) => { summe += gewicht(a); });
    let x = r() * summe;
    let wahl = "wechselweise";
    for (const a of arten) {
      const w = gewicht(a);
      if (x < w) { wahl = a[0]; break; }
      x -= w;
    }
    p.zuletzt = wahl;

    const reihen = [];
    if (wahl === "wechselweise") {
      // Abwechselnd links und rechts, je ein Ding, mal wechseln, mal bleiben.
      const n = anzahl(6, 10);
      let bahn = r() < 0.5 ? 0 : 1;
      for (let i = 0; i < n; i += 1) {
        reihen.push(inBahn(i ? 0.5 : 1, bahn, r() < ps ? "w" : "b"));
        bahn = 1 - bahn;
      }
    } else if (wahl === "doppel") {
      // Beide Kanäle auf derselben Höhe – oft beide wechseln: ein Doppeltipp,
      // gespiegelt oder parallel, je nachdem, wo die Bobs gerade sind.
      const n = anzahl(3, 5);
      for (let i = 0; i < n; i += 1) {
        const x2 = r();
        if (x2 < lerp(0.5, 0.8, k)) reihen.push(reihe(1, "w", "w"));
        else if (x2 < 0.92) reihen.push(inBahn(1, r() < 0.5 ? 0 : 1, "w", "b"));
        else reihen.push(reihe(1, "s", "s"));
      }
    } else if (wahl === "tore") {
      // Stern und Hindernis nebeneinander: Hier geht es durch.
      const n = anzahl(4, 6);
      let bahn = r() < 0.5 ? 0 : 1;
      for (let i = 0; i < n; i += 1) {
        reihen.push(inBahn(i ? 0.6 : 1, bahn, r() < ps ? "tw" : "t"));
        bahn = 1 - bahn;
      }
    } else if (wahl === "slalom") {
      // In einem Kanal Wechsel um Wechsel, so dicht, wie es eben geht – und
      // im anderen kommen derweil Sterne, die man nicht verpassen darf.
      const bahn = r() < 0.5 ? 0 : 1;
      const n = anzahl(4, 6);
      const eng = Math.max(0.72, (abstandBei(p.y) + 6) / schlagBei(p.y));
      for (let i = 0; i < n; i += 1) reihen.push(inBahn(i ? eng : 1, bahn, "w", i % 2 ? "s" : null));
    } else if (wahl === "gegen") {
      // Zickzack in beiden Kanälen, um einen halben Schlag versetzt: links
      // wechseln, rechts wechseln, links, rechts …
      const n = anzahl(6, 10);
      let bahn = r() < 0.5 ? 0 : 1;
      for (let i = 0; i < n; i += 1) {
        reihen.push(inBahn(i ? 0.5 : 1, bahn, "w"));
        bahn = 1 - bahn;
      }
    } else {
      // Zum Durchatmen: Sterne in beiden Kanälen, wo die Bobs schon sind.
      const n = anzahl(3, 4);
      for (let i = 0; i < n; i += 1) reihen.push(reihe(i ? 0.5 : 1, "s", "s"));
    }
    return reihen;
  }

  function hindernisArt() {
    const x = zufall.zahl();
    return x < 0.45 ? "tanne" : x < 0.75 ? "stein" : "mann";
  }

  function dingNeu(bahn, spur, art, y, zeile) {
    const p = state.plan;
    const d = {
      id: p.dinge, y, bahn, spur, art, zeile,
      zustand: "offen", minDx: 99, wackel: 0, ph: hash01(p.dinge * 1.37 + 0.2) * TAU,
    };
    p.dinge += 1;
    state.dinge.push(d);
    zeile.dinge.push(d);
    return d;
  }

  function naechsteReihe() {
    const p = state.plan;
    if (!p.muster.length) p.muster = musterWaehlen();
    const r = p.muster.shift();
    const y = p.erste ? VORLAUF : p.y + r.s * schlagBei(p.y);
    p.erste = false;
    p.y = y;
    const zeile = { id: p.reihen, y, doppel: false, dinge: [], bonus: false };
    p.reihen += 1;
    let wechsel = 0;
    [r.L, r.R].forEach((was, bahn) => {
      if (!was) return;
      let w = was === "w" || was === "sw" || was === "hw" || was === "tw";
      if (w && y - p.letztY[bahn] < abstandBei(y)) w = false;
      const neu = w ? 1 - p.soll[bahn] : p.soll[bahn];
      let stern = was === "s" || was === "sw" || was === "t" || was === "tw";
      let hindernis = was === "hw" || was === "t" || was === "tw";
      // Frei gewürfelt: ein Stern, ein Hindernis – oder beides als Tor.
      if (was === "w" || was === "b") {
        const x = zufall.zahl();
        stern = x < 0.62;
        hindernis = x >= 0.4;
      }
      if (stern) dingNeu(bahn, neu, "stern", y, zeile);
      if (hindernis) dingNeu(bahn, 1 - neu, hindernisArt(), y, zeile);
      p.soll[bahn] = neu;
      p.letztY[bahn] = y;
      if (w) wechsel += 1;
    });
    zeile.doppel = wechsel === 2;
    if (zeile.doppel) state.zeilen.push(zeile);
  }

  function planBis(y) {
    while (state.plan.y < y) naechsteReihe();
  }

  // ---------------------------------------------------------------------------
  // Ein Schritt der Fahrt
  // ---------------------------------------------------------------------------
  const schlittenX = (sl) => spurX(sl.bahn, glatt(sl.k / K));

  function simSchritt() {
    state.tick += 1;
    state.weg += tempoBei(state.weg) * TAKT;
    for (const sl of state.schlitten) {
      if (sl.ziel === 1) { if (sl.k < K) sl.k += 1; } else if (sl.k > 0) sl.k -= 1;
    }
    planBis(state.weg + 900);
    pruefen();
  }

  // Was die Bobs gerade erreichen: Sterne nehmen, an Hindernissen vorbei –
  // oder hinein. Die Liste ist nach der Strecke geordnet; was weiter voraus
  // liegt, ist noch nicht dran.
  function pruefen() {
    const dinge = state.dinge;
    for (let i = state.erstes; i < dinge.length; i += 1) {
      const d = dinge[i];
      const ab = d.y - state.weg;
      if (ab > TREFF_L + 4) break;
      if (d.zustand !== "offen") continue;
      const dx = Math.abs(schlittenX(state.schlitten[d.bahn]) - spurX(d.bahn, d.spur));
      if (d.art === "stern") {
        if (ab < STERN_L && ab > -STERN_L && dx < STERN_X) nimm(d);
        else if (ab <= -STERN_L) {
          // Beim Zuschauen sagt der Zug, wie es ausging (zugAnwenden).
          if (zuschauend()) d.zustand = "verpasst";
          else { fehler(d); return; }
        }
      } else if (ab < TREFF_L && ab > -TREFF_L) {
        if (dx < TREFF_X) {
          if (zuschauend()) d.zustand = "durch";
          else { fehler(d); return; }
        } else d.minDx = Math.min(d.minDx, dx);
      } else if (ab <= -TREFF_L) vorbei(d);
    }
    while (state.erstes < dinge.length && dinge[state.erstes].zustand !== "offen") state.erstes += 1;
  }

  function punkteZeigen() {
    if (gezeigt === state.punkte) return;
    gezeigt = state.punkte;
    shell.setCount(state.punkte);
  }

  function nimm(d) {
    d.zustand = "genommen";
    state.punkte += 1;
    state.sterne += 1;
    state.puls = 1;
    punkteZeigen();
    const x = spurX(d.bahn, d.spur);
    funken(x, d.y, ruhig() ? 4 : 11, 0.9);
    schrift("+1", bx(x), by(d.y) - 14, "#ffd23f", 1.2, 0.75);
    if (state.punkte % 10 === 0) {
      state.glanz = 1;
      klang()?.ton("meilenstein");
    } else tonMitPause("punkt", { laut: 0.8 });
    erledigt(d);
  }

  function vorbei(d) {
    d.zustand = "vorbei";
    if (d.minDx < KNAPP_X) {
      const sl = state.schlitten[d.bahn];
      schrift("knapp!", bx(schlittenX(sl)), view.sy - 34, "#ffffff", 0.75, 0.6);
    }
    erledigt(d);
  }

  // Ein Doppeltipp, den beide geschafft haben: ein Punkt dazu.
  function erledigt(d) {
    const z = d.zeile;
    if (!z.doppel || z.bonus) return;
    if (!z.dinge.every((x) => x.zustand === "genommen" || x.zustand === "vorbei")) return;
    z.bonus = true;
    state.punkte += 1;
    state.doppel += 1;
    state.puls = 1;
    punkteZeigen();
    schrift("Doppelt! +1", view.mx, view.sy - 58, "#ffb22e", 1.25, 1);
    state.schlitten.forEach((sl) => funken(schlittenX(sl), state.weg + 8, ruhig() ? 3 : 8, 1));
    // Die Harfe – nicht noch einmal, wenn der Doppeltipp gleich auf den
    // vorigen folgt.
    doppelReihe = z.id === doppelZeile + 1 ? doppelReihe + 1 : 1;
    doppelZeile = z.id;
    if (doppelReihe < 2) klang()?.ton("perfekt", { laut: 0.8 });
  }

  // ---------------------------------------------------------------------------
  // Der Fehler
  // ---------------------------------------------------------------------------
  // Beim Spielen aus pruefen, beim Zuschauen aus dem letzten Zug.
  function fehlerBeginnt(d) {
    const stern = d.art === "stern";
    d.zustand = stern ? "verpasst" : "getroffen";
    d.wackel = 1;
    const x = spurX(d.bahn, d.spur);
    state.fehler = { ding: d, art: d.art, bahn: d.bahn, x, y: d.y, zeit: 0, text: stern ? "Stern verpasst!" : `${NAMEN[d.art]}!` };
    state.lupe = 1;
    state.stoss = stern ? 0.35 : 1;
    // Die Kufen verstummen. Ein Hindernis kracht; ein verpasster Stern ist
    // kein Crash, nur das Ende.
    kufenAus();
    klang()?.ton(stern ? "fehler" : "spuren.crash");
    const sl = state.schlitten[d.bahn];
    if (!stern) {
      sl.crash = true;
      sl.drehZiel = (x > schlittenX(sl) ? -1 : 1) * (0.7 + Math.random() * 0.5);
      sl.rueckV = 60;
      schneeBurst(x, d.y - 6, ruhig() ? 12 : 42);
    } else {
      funken(x, d.y, 6, 0.3);
    }
  }

  function fehler(d) {
    fehlerBeginnt(d);
    const art = (d.art === "stern" ? ZUG_STERN : ZUG_HINDERNIS) + d.bahn;
    meldeZug(art, d.id);
    state.phase = "ende";
    kids()?.vibrate?.(d.art === "stern" ? [20, 30, 40] : [30, 40, 70]);
    stepTimer = window.setTimeout(finish, ENDE_MS);
  }

  // Nach dem Fehler: Zeitlupe, bis alles steht. Der getroffene Bob bleibt am
  // Hindernis hängen (rueck), der andere gleitet aus.
  function nachlauf(dt) {
    const f = state.fehler;
    f.zeit += dt;
    state.lupe = Math.max(0.04, 1 - f.zeit * 5.5);
    const dw = tempoBei(state.weg) * state.lupe * dt;
    state.weg += dw;
    for (const sl of state.schlitten) {
      if (!sl.crash) continue;
      sl.rueck += dw + sl.rueckV * dt;
      sl.rueckV *= Math.max(0, 1 - dt * 7);
    }
  }

  // ---------------------------------------------------------------------------
  // Die Fläche
  // ---------------------------------------------------------------------------
  // Der Hinweis vor dem ersten Tipp: ein Ring über jedem Kanal, der sich füllt.
  function ringBauen() {
    const tipp = shell.el("span", "zs-tipp");
    tipp.setAttribute("aria-hidden", "true");
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    [
      { stroke: "rgba(255,255,255,0.55)", klasse: "" },
      { stroke: "#ffffff", klasse: "zs-tipp-fuell" },
    ].forEach((ring) => {
      const kreis = document.createElementNS(ns, "circle");
      kreis.setAttribute("cx", "32");
      kreis.setAttribute("cy", "32");
      kreis.setAttribute("r", "22");
      kreis.setAttribute("fill", "none");
      kreis.setAttribute("stroke", ring.stroke);
      kreis.setAttribute("stroke-width", "5");
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
    return tipp;
  }

  function buildFeld() {
    // Die Fläche liegt über der ganzen Spielfläche, auf dem Handy auch unter
    // den Knöpfen (styles.css, .zs-feld; game-shell.js, frei).
    feld = shell.el("div", "zs-feld");
    canvas = document.createElement("canvas");
    canvas.className = "zs-canvas";
    canvas.setAttribute("aria-hidden", "true");
    feld.append(canvas);
    g = canvas.getContext("2d");
    tipps = [ringBauen(), ringBauen()];
    tipps.forEach((t) => feld.append(t));
    return feld;
  }

  // Der Satz vor dem ersten Tipp: oben in der Mitte, unter den Knöpfen
  // (styles.css, .zs-prompt; messen rückt ihn unter die Anzeige).
  function buildPrompt() {
    return shell.el("p", "cm-prompt zs-prompt", "Links tippen lenkt Rot, rechts lenkt Blau.");
  }

  function messen() {
    if (!canvas || !feld) return;
    const cssW = Math.max(80, feld.clientWidth);
    const cssH = Math.max(80, feld.clientHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    // Auf dem Handy reicht die Leinwand unter die Knöpfe oben (game-shell.js,
    // frei). Gemalt wird dort auch – aber was zählt, steht darunter.
    const frei = Math.min(cssH * 0.4, shell?.frei?.(canvas) || 0);
    if (cssW === view.cssW && cssH === view.cssH && dpr === view.dpr && frei === view.frei) return;
    view.cssW = cssW;
    view.cssH = cssH;
    view.dpr = dpr;
    view.frei = frei;
    const nutzH = cssH - frei;
    // Beide Kanäle stehen immer ganz im Bild und davor mindestens SICHT_H
    // Strecke; hochkant füllen die Kanäle die Breite, quer und am Rechner
    // stehen sie in der Mitte, links und rechts Landschaft.
    view.s = Math.min(cssW / WELT_W, nutzH / SICHT_H);
    view.mx = cssW / 2;
    view.sy = frei + nutzH * SCHLITTEN_AN;
    view.vorn = view.sy / view.s;
    view.hinten = (cssH - view.sy) / view.s;
    view.halb = cssW / 2 / view.s;
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    vorrendern();
    tipps.forEach((t, bahn) => {
      t.style.left = `${Math.round(view.mx + spurX(bahn, 0.5) * view.s)}px`;
      t.style.top = `${Math.round(view.sy - nutzH * 0.3)}px`;
    });
    // Auf einem schmalen Bild stünde der Satz über der Anzeige: dann darunter.
    const anzeigeH = clamp(cssH * 0.05, 14, 24) * 1.6;
    if (prompt) prompt.style.top = `${Math.round(frei + (cssW < 560 ? 20 + anzeigeH : 10))}px`;
  }

  const bx = (x) => view.mx + x * view.s;
  const by = (y) => view.sy - (y - state.weg) * view.s;

  // ---------------------------------------------------------------------------
  // Vorgemalt
  // ---------------------------------------------------------------------------
  function leinwand(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // Ein Bild in Welteinheiten, quadratisch um seine Mitte: r ist die halbe
  // Seite. Gezeichnet wird es mit bildMalen.
  function sprite(r, malen) {
    const f = view.s * view.dpr;
    const px = Math.max(2, Math.ceil(r * 2 * f));
    const c = leinwand(px, px);
    const k = c.getContext("2d");
    k.setTransform(f, 0, 0, f, px / 2, px / 2);
    malen(k);
    c.welt = r;
    return c;
  }

  function bildMalen(bild, x, y, mal = 1) {
    const w = bild.welt * 2 * view.s * mal;
    g.drawImage(bild, x - w / 2, y - w / 2, w, w);
  }

  function zacken(k, cx, cy, ra, ri, n, dreh) {
    k.beginPath();
    for (let i = 0; i < n * 2; i += 1) {
      const w = dreh + (i * Math.PI) / n;
      const r = i % 2 ? ri : ra;
      if (i) k.lineTo(cx + Math.cos(w) * r, cy + Math.sin(w) * r);
      else k.moveTo(cx + Math.cos(w) * r, cy + Math.sin(w) * r);
    }
    k.closePath();
  }

  // Eine Tanne von oben: Lagen aus Zweigen, nach oben heller, Schnee auf der
  // Seite, von der das Licht kommt (oben links).
  // teil: "schatten" oder "krone" – ein Wald malt erst alle Schatten, dann
  // alle Kronen, sonst läge ein Schatten über dem Baum daneben.
  function tanneMalen(k, R, farben, teil = "") {
    if (teil !== "krone") {
      k.fillStyle = "rgba(105, 122, 188, 0.2)";
      k.beginPath();
      k.ellipse(R * 0.34, R * 0.42, R * 1.02, R * 0.86, 0.3, 0, TAU);
      k.fill();
    }
    if (teil === "schatten") return;
    for (let j = 0; j < 4; j += 1) {
      const r = R * (1 - j * 0.23);
      const ox = -j * R * 0.06;
      const oy = -j * R * 0.07;
      const dreh = j * 0.37;
      zacken(k, ox, oy, r, r * 0.72, 9, dreh);
      k.fillStyle = farben[j];
      k.fill();
      k.fillStyle = "rgba(255, 255, 255, 0.92)";
      for (let i = 0; i < 9; i += 1) {
        const w = dreh + (i * TAU) / 9;
        if (Math.cos(w + 2.36) < 0.25) continue;
        k.beginPath();
        k.arc(ox + Math.cos(w) * r * 0.78, oy + Math.sin(w) * r * 0.78, r * 0.14, 0, TAU);
        k.fill();
      }
    }
    k.fillStyle = "#f2fbff";
    k.beginPath();
    k.arc(-R * 0.22, -R * 0.26, R * 0.13, 0, TAU);
    k.fill();
  }

  // Ein Felsbrocken, wie die anderen Hindernisse leicht schräg von vorn:
  // links im Licht, rechts im Schatten, oben eine Kappe Schnee.
  function steinMalen(k) {
    k.fillStyle = "rgba(90, 110, 170, 0.28)";
    k.beginPath();
    k.ellipse(3, 6.5, 14, 5, 0, 0, TAU);
    k.fill();
    const umriss = [[-13, 5], [-14, -2], [-10, -9], [-3, -13], [5, -12.5], [11.5, -8], [14, -1], [12.5, 5.5], [3, 8], [-7, 7.5]];
    const form = (mal, dx, dy) => {
      k.beginPath();
      umriss.forEach(([x, y], i) => (i ? k.lineTo(x * mal + dx, y * mal + dy) : k.moveTo(x * mal + dx, y * mal + dy)));
      k.closePath();
    };
    form(1, 0, 0);
    k.fillStyle = "#66718a";
    k.fill();
    form(0.82, -2, -1.2);
    k.fillStyle = "#828da4";
    k.fill();
    form(0.5, -4.5, -2.8);
    k.fillStyle = "#a2acbf";
    k.fill();
    k.fillStyle = "#ffffff";
    k.beginPath();
    k.moveTo(-10, -8);
    k.quadraticCurveTo(-4, -15, 5, -12.6);
    k.quadraticCurveTo(11, -9.5, 11.5, -6.5);
    k.quadraticCurveTo(6, -7.5, 3, -5.6);
    k.quadraticCurveTo(-2, -8.2, -5, -5.4);
    k.quadraticCurveTo(-8, -6.5, -10, -8);
    k.closePath();
    k.fill();
  }

  // Die Hindernisse stehen auf dem Eis und sind leicht schräg von vorn
  // gezeichnet – anders als die Landschaft, die man nur von oben sieht. So
  // springen sie als «das ist im Weg» ins Auge. Der Fuss steht dort, wo
  // getroffen wird (die Mitte des Bildes), die Spitze ragt voraus.
  function tanneStehendMalen(k) {
    k.fillStyle = "rgba(90, 110, 170, 0.28)";
    k.beginPath();
    k.ellipse(3, 7, 13, 5, 0, 0, TAU);
    k.fill();
    k.fillStyle = "#6b4426";
    k.fillRect(-2.2, 2, 4.4, 6);
    const lagen = [
      { unten: 4, oben: -10, breit: 13, farbe: "#1f6a4a" },
      { unten: -4, oben: -17, breit: 10.5, farbe: "#258056" },
      { unten: -11, oben: -24, breit: 8, farbe: "#2f9464" },
    ];
    lagen.forEach((l) => {
      k.fillStyle = l.farbe;
      k.beginPath();
      k.moveTo(0, l.oben);
      k.lineTo(l.breit, l.unten);
      k.quadraticCurveTo(0, l.unten + 2.4, -l.breit, l.unten);
      k.closePath();
      k.fill();
      // Licht von links, Schatten rechts
      k.fillStyle = "rgba(0, 30, 20, 0.22)";
      k.beginPath();
      k.moveTo(0, l.oben);
      k.lineTo(l.breit, l.unten);
      k.quadraticCurveTo(l.breit * 0.4, l.unten + 1.6, 0, l.unten + 1.2);
      k.closePath();
      k.fill();
      // Schnee auf der Lage
      k.fillStyle = "#ffffff";
      k.beginPath();
      k.moveTo(0, l.oben - 0.6);
      k.lineTo(l.breit * 0.45, l.oben + (l.unten - l.oben) * 0.45);
      k.quadraticCurveTo(l.breit * 0.15, l.oben + (l.unten - l.oben) * 0.32, -l.breit * 0.05, l.oben + (l.unten - l.oben) * 0.5);
      k.quadraticCurveTo(-l.breit * 0.3, l.oben + (l.unten - l.oben) * 0.38, -l.breit * 0.55, l.oben + (l.unten - l.oben) * 0.55);
      k.closePath();
      k.fill();
    });
  }

  function mannMalen(k) {
    k.fillStyle = "rgba(90, 110, 170, 0.28)";
    k.beginPath();
    k.ellipse(3, 8, 12.5, 4.6, 0, 0, TAU);
    k.fill();
    const kugel = (r, dx, dy) => {
      const v = k.createRadialGradient(dx - r * 0.4, dy - r * 0.4, r * 0.1, dx, dy, r);
      v.addColorStop(0, "#ffffff");
      v.addColorStop(0.7, "#eef4fb");
      v.addColorStop(1, "#bccce3");
      k.fillStyle = v;
      k.beginPath();
      k.arc(dx, dy, r, 0, TAU);
      k.fill();
    };
    // Äste als Arme
    k.strokeStyle = "#6b4426";
    k.lineCap = "round";
    k.lineWidth = 1.3;
    [-1, 1].forEach((seite) => {
      k.beginPath();
      k.moveTo(seite * 5.5, -7.5);
      k.lineTo(seite * 12.5, -12);
      k.moveTo(seite * 10.5, -10.8);
      k.lineTo(seite * 11.5, -14.5);
      k.stroke();
    });
    kugel(9.5, 0, 2.5);
    kugel(7, 0, -8);
    // Knöpfe
    k.fillStyle = "#2a2f3b";
    [-10.5, -7.5, -4.5].forEach((y) => {
      k.beginPath();
      k.arc(0, y, 0.85, 0, TAU);
      k.fill();
    });
    // Schal
    k.fillStyle = "#e5484d";
    k.beginPath();
    k.ellipse(0, -13.6, 5.6, 1.9, 0, 0, TAU);
    k.fill();
    k.fillRect(2, -13.5, 2.4, 6);
    kugel(5, 0, -18);
    // Augen und die Rübe
    k.fillStyle = "#2a2f3b";
    k.beginPath();
    k.arc(-1.7, -19, 0.8, 0, TAU);
    k.arc(1.7, -19, 0.8, 0, TAU);
    k.fill();
    k.fillStyle = "#ff8a1f";
    k.beginPath();
    k.moveTo(-0.6, -17.6);
    k.lineTo(0.9, -16.8);
    k.lineTo(-0.2, -13.4);
    k.closePath();
    k.fill();
    // Hut
    k.fillStyle = "#262b38";
    k.beginPath();
    k.ellipse(0, -22.2, 6.4, 1.7, 0, 0, TAU);
    k.fill();
    k.fillRect(-4, -29, 8, 7);
    k.fillStyle = "#e5484d";
    k.fillRect(-4, -24.4, 8, 1.6);
    k.fillStyle = "#3d4558";
    k.beginPath();
    k.ellipse(0, -29, 4, 1.2, 0, 0, TAU);
    k.fill();
  }

  function sternPfad(k, cx, cy, ra, ri, dreh = -Math.PI / 2) {
    zacken(k, cx, cy, ra, ri, 5, dreh);
  }

  function sternMalen(k, R, grau) {
    k.fillStyle = "rgba(120, 90, 30, 0.22)";
    sternPfad(k, R * 0.18, R * 0.24, R, R * 0.46);
    k.fill();
    const v = k.createLinearGradient(-R, -R, R, R);
    if (grau) {
      v.addColorStop(0, "#d7dbe3");
      v.addColorStop(1, "#8d94a3");
    } else {
      v.addColorStop(0, "#fff2a6");
      v.addColorStop(0.45, "#ffcf33");
      v.addColorStop(1, "#f29a0c");
    }
    k.fillStyle = v;
    sternPfad(k, 0, 0, R, R * 0.46);
    k.fill();
    k.lineWidth = R * 0.1;
    k.lineJoin = "round";
    k.strokeStyle = grau ? "#6f7684" : "#d9820a";
    k.stroke();
    k.fillStyle = grau ? "rgba(255,255,255,0.35)" : "rgba(255, 255, 255, 0.7)";
    sternPfad(k, -R * 0.16, -R * 0.2, R * 0.42, R * 0.18);
    k.fill();
  }

  function leuchtMalen(k, R, farbe) {
    const v = k.createRadialGradient(0, 0, 0, 0, 0, R);
    v.addColorStop(0, farbe);
    v.addColorStop(1, "rgba(0, 0, 0, 0)");
    k.fillStyle = v;
    k.fillRect(-R, -R, R * 2, R * 2);
  }

  // Eine Hütte von oben: das verschneite Satteldach, links im Licht, rechts
  // im Schatten, am Rand das Holz, auf dem Dach der Kamin mit etwas Rauch.
  function huetteMalen(k) {
    k.fillStyle = "rgba(105, 122, 188, 0.24)";
    k.fillRect(-14, -9, 39, 32);
    k.fillStyle = "#7a4b2b";
    k.fillRect(-20, -16, 40, 32);
    const licht = k.createLinearGradient(-19, 0, 0, 0);
    licht.addColorStop(0, "#ffffff");
    licht.addColorStop(1, "#edf3fa");
    k.fillStyle = licht;
    k.fillRect(-19, -15, 19, 30);
    const schatten = k.createLinearGradient(0, 0, 19, 0);
    schatten.addColorStop(0, "#c9d6ea");
    schatten.addColorStop(1, "#dbe5f2");
    k.fillStyle = schatten;
    k.fillRect(0, -15, 19, 30);
    for (let y = -14; y <= 14; y += 4) {
      k.fillStyle = "#ffffff";
      k.beginPath();
      k.arc(-19, y, 2.1, 0, TAU);
      k.fill();
      k.fillStyle = "#e3ebf6";
      k.beginPath();
      k.arc(19, y, 1.9, 0, TAU);
      k.fill();
    }
    k.fillStyle = "#aebed6";
    k.fillRect(-0.9, -15.5, 1.8, 31);
    k.fillStyle = "#8f3a2a";
    k.fillRect(6, -10, 6, 6);
    k.fillStyle = "#ffffff";
    k.fillRect(5.6, -10.4, 6.8, 2.4);
    [[12, -14, 2.6], [15.5, -19, 3.4], [20, -24, 4.2]].forEach(([x, y, r], i) => {
      k.fillStyle = `rgba(214, 222, 236, ${(0.85 - i * 0.22).toFixed(2)})`;
      k.beginPath();
      k.arc(x, y, r, 0, TAU);
      k.fill();
    });
  }

  /*
   * Der Boden, eine Kachel lang: Schneefeld mit Verwehungen, Skispuren und
   * Steinen, das orange Netz am Rand, die zwei Eiskanäle mit ihren Wänden
   * (links rot, rechts blau) und dazwischen der Schneerücken mit Stangen. Er
   * wiederholt sich nahtlos – was über einen Rand ragt, steht am anderen noch
   * einmal.
   */
  function bodenMalen() {
    const s = view.s;
    // Bildpunkt auf Bildpunkt wie die Leinwand – nur auf einem sehr grossen
    // Bild mit vielen Bildpunkten je Pixel etwas gröber (höchstens 7 Millionen
    // Bildpunkte), dann wird sie beim Zeichnen gestreckt.
    const dpr = Math.min(view.dpr, Math.sqrt(7e6 / Math.max(1, view.cssW * KACHEL * s)));
    const breit = Math.round(view.cssW * dpr);
    const hoch = Math.round(KACHEL * s * dpr);
    const c = leinwand(breit, hoch);
    c.dpr = dpr;
    const k = c.getContext("2d");
    const f = s * dpr;
    k.setTransform(f, 0, 0, hoch / KACHEL, breit / 2, 0);
    const halb = view.cssW / 2 / s + 4;
    k.fillStyle = "#f3f7fb";
    k.fillRect(-halb, -4, halb * 2, KACHEL + 8);
    const rund = (y, r, malen) => {
      malen(y);
      if (y - r < 0) malen(y + KACHEL);
      if (y + r > KACHEL) malen(y - KACHEL);
    };

    // Verwehungen: ein bläulicher Schatten, darüber weisser Schnee.
    for (let i = 0; i < 110; i += 1) {
      const x = (hash01(i * 3.17 + 1) * 2 - 1) * halb;
      if (Math.abs(x) < RAND + 10) continue;
      const y = hash01(i * 5.31 + 2) * KACHEL;
      const rx = 12 + hash01(i * 7.7 + 3) * 38;
      const ry = rx * (0.22 + hash01(i * 2.2 + 4) * 0.2);
      rund(y, ry + 6, (yy) => {
        k.fillStyle = "rgba(150, 172, 218, 0.2)";
        k.beginPath();
        k.ellipse(x + rx * 0.12, yy + ry * 0.55, rx, ry, 0, 0, TAU);
        k.fill();
        k.fillStyle = "rgba(255, 255, 255, 0.9)";
        k.beginPath();
        k.ellipse(x - rx * 0.05, yy - ry * 0.1, rx * 0.86, ry * 0.75, 0, 0, TAU);
        k.fill();
      });
    }

    // Skispuren im Schnee daneben: zwei Linien, die sich sacht winden.
    k.lineWidth = 1;
    k.strokeStyle = "rgba(140, 160, 205, 0.35)";
    [-1, 1].forEach((seite, n) => {
      const mitte = RAND + 40 + n * 35;
      if (mitte > halb) return;
      [-2.2, 2.2].forEach((versatz) => {
        k.beginPath();
        for (let y = -4; y <= KACHEL + 4; y += 8) {
          const x = seite * (mitte + Math.sin((y / KACHEL) * TAU * 2 + n) * 14) + versatz;
          if (y < 0) k.moveTo(x, y); else k.lineTo(x, y);
        }
        k.stroke();
      });
    });

    // Kleine Steine und Büsche
    for (let i = 0; i < 40; i += 1) {
      const seite = i % 2 ? 1 : -1;
      const x = seite * (RAND + 22 + hash01(i * 9.1 + 5) * Math.max(10, halb - RAND - 30));
      const y = hash01(i * 4.7 + 6) * KACHEL;
      const r = 2.2 + hash01(i * 6.3 + 7) * 3.5;
      const busch = hash01(i * 8.8 + 8) < 0.45;
      rund(y, r + 3, (yy) => {
        k.fillStyle = "rgba(70, 90, 140, 0.18)";
        k.beginPath();
        k.ellipse(x + r * 0.4, yy + r * 0.5, r * 1.1, r * 0.8, 0, 0, TAU);
        k.fill();
        k.fillStyle = busch ? "#3b7a5a" : "#7d889c";
        k.beginPath();
        k.arc(x, yy, r, 0, TAU);
        k.fill();
        k.fillStyle = "#ffffff";
        k.beginPath();
        k.ellipse(x - r * 0.25, yy - r * 0.3, r * 0.6, r * 0.4, -0.4, 0, TAU);
        k.fill();
      });
    }

    // Wolkenschatten: grosse, weiche, bläuliche Flecken
    for (let i = 0; i < 5; i += 1) {
      const x = (hash01(i * 8.3 + 21) * 2 - 1) * halb;
      const y = hash01(i * 4.9 + 22) * KACHEL;
      const r = 90 + hash01(i * 3.1 + 23) * 90;
      rund(y, r, (yy) => {
        const v = k.createRadialGradient(x, yy, 0, x, yy, r);
        v.addColorStop(0, "rgba(128, 144, 204, 0.13)");
        v.addColorStop(0.6, "rgba(128, 144, 204, 0.07)");
        v.addColorStop(1, "rgba(128, 144, 204, 0)");
        k.fillStyle = v;
        k.fillRect(x - r, yy - r, r * 2, r * 2);
      });
    }

    // Der Wald daneben, mit einer Hütte je Seite, wo Platz ist. Erst alle
    // Schatten, dann alle Kronen.
    const seiteBreit = halb + 10 - (RAND + 26);
    const huetten = [];
    if (seiteBreit > 90) {
      [-1, 1].forEach((seite, n) => {
        huetten.push({ x: seite * (RAND + 60 + hash01(n * 5.5 + 31) * Math.min(120, seiteBreit - 70)), y: hash01(n * 7.7 + 32) * KACHEL });
      });
    }
    const baeume = [];
    const anzahl = Math.max(0, Math.round((seiteBreit * KACHEL) / 1150));
    for (let i = 0; i < anzahl * 2; i += 1) {
      const seite = i % 2 ? 1 : -1;
      const x = seite * (RAND + 26 + hash01(i * 3.9 + 41) * seiteBreit);
      const y = hash01(i * 6.1 + 42) * KACHEL;
      const R = 10 + hash01(i * 2.7 + 43) * 12;
      const zuNah = huetten.some((h) => {
        const dy = Math.min(Math.abs(h.y - y), KACHEL - Math.abs(h.y - y));
        return Math.abs(h.x - x) < 30 + R && dy < 26 + R;
      });
      if (!zuNah) baeume.push({ x, y, R });
    }
    const dunkel = ["#1b4c3a", "#22604a", "#2c7457", "#3f8c69"];
    ["schatten", "krone"].forEach((teil) => {
      baeume.forEach((b) => rund(b.y, b.R * 1.5, (yy) => {
        k.save();
        k.translate(b.x, yy);
        tanneMalen(k, b.R, dunkel, teil);
        k.restore();
      }));
    });
    huetten.forEach((h) => rund(h.y, 30, (yy) => {
      k.save();
      k.translate(h.x, yy);
      huetteMalen(k);
      k.restore();
    }));

    // Der Schneewall aussen an den Kanälen, mit Schatten nach aussen
    [-1, 1].forEach((seite) => {
      const v = k.createLinearGradient(seite * RAND, 0, seite * (RAND + 16), 0);
      v.addColorStop(0, "rgba(255, 255, 255, 1)");
      v.addColorStop(0.5, "rgba(214, 224, 244, 0.8)");
      v.addColorStop(1, "rgba(214, 224, 244, 0)");
      k.fillStyle = v;
      k.fillRect(seite > 0 ? RAND : -RAND - 16, -4, 16, KACHEL + 8);
    });

    // Das orange Netz am Rand, an Pfosten
    [-1, 1].forEach((seite) => {
      const x = seite * (RAND + 7);
      k.strokeStyle = "rgba(245, 166, 35, 0.75)";
      k.lineWidth = 1.2;
      k.beginPath();
      k.moveTo(x, -4);
      k.lineTo(x, KACHEL + 4);
      k.stroke();
      for (let y = 0; y < KACHEL; y += 40) {
        k.fillStyle = "rgba(70, 90, 140, 0.25)";
        k.beginPath();
        k.ellipse(x + 1.6, y + 2, 2, 1.4, 0, 0, TAU);
        k.fill();
        k.fillStyle = "#8a5a35";
        k.beginPath();
        k.arc(x, y, 1.6, 0, TAU);
        k.fill();
      }
    });

    // Die zwei Kanäle
    const WANDFARBE = [["#ff9aa0", "#e4484f"], ["#9cc4ff", "#2f74e0"]];
    [0, 1].forEach((bahn) => {
      const x0 = bahn === 0 ? -BODEN_AUSSEN : MITTE / 2;
      const x1 = x0 + SPUR * 2;
      const eis = k.createLinearGradient(x0, 0, x1, 0);
      eis.addColorStop(0, "#a9d2ea");
      eis.addColorStop(0.1, "#cde9f7");
      eis.addColorStop(0.5, "#e5f5fc");
      eis.addColorStop(0.9, "#cde9f7");
      eis.addColorStop(1, "#a9d2ea");
      k.fillStyle = eis;
      k.fillRect(x0, -4, x1 - x0, KACHEL + 8);
      // Kratzer und Glanz im Eis
      k.lineWidth = 0.7;
      for (let i = 0; i < 16; i += 1) {
        const x = x0 + 3 + hash01(i * 2.9 + bahn * 17 + 9) * (x1 - x0 - 6);
        const y = hash01(i * 3.7 + bahn * 13 + 10) * KACHEL;
        const lang = 20 + hash01(i * 5.9 + bahn * 7 + 11) * 80;
        const schief = (hash01(i * 7.3 + bahn + 12) - 0.5) * 4;
        k.strokeStyle = i % 3 ? "rgba(255, 255, 255, 0.6)" : "rgba(120, 170, 210, 0.3)";
        rund(y, lang, (yy) => {
          k.beginPath();
          k.moveTo(x, yy);
          k.lineTo(x + schief, yy + lang);
          k.stroke();
        });
      }
      // Die Rille zwischen den Spuren
      k.strokeStyle = "rgba(100, 150, 200, 0.45)";
      k.lineWidth = 1.3;
      k.setLineDash([14, 16]);
      k.beginPath();
      k.moveTo(x0 + SPUR, -15);
      k.lineTo(x0 + SPUR, KACHEL + 15);
      k.stroke();
      k.setLineDash([]);
      // Die Wände: weiss gepolstert, mit dem Band in der Farbe des Bobs,
      // dazu ihr Schatten auf dem Eis.
      [[x0 - WAND, 1], [x1, -1]].forEach(([wx, innen]) => {
        const kante = innen > 0 ? wx + WAND : wx;
        const sch = k.createLinearGradient(kante, 0, kante + innen * 6, 0);
        sch.addColorStop(0, "rgba(70, 110, 160, 0.3)");
        sch.addColorStop(1, "rgba(70, 110, 160, 0)");
        k.fillStyle = sch;
        k.fillRect(innen > 0 ? kante : kante - 6, -4, 6, KACHEL + 8);
        k.fillStyle = "#ffffff";
        k.fillRect(wx, -4, WAND, KACHEL + 8);
        k.fillStyle = WANDFARBE[bahn][0];
        k.fillRect(wx + WAND * 0.22, -4, WAND * 0.56, KACHEL + 8);
        k.fillStyle = WANDFARBE[bahn][1];
        k.fillRect(wx + WAND * 0.42, -4, WAND * 0.16, KACHEL + 8);
        // Die Stösse zwischen den Polstern
        k.fillStyle = "rgba(255, 255, 255, 0.85)";
        for (let y = 0; y < KACHEL; y += 40) k.fillRect(wx, y, WAND, 1.4);
      });
    });

    // Der Schneerücken in der Mitte mit orangen Stangen
    k.fillStyle = "#ffffff";
    k.fillRect(-MITTE / 2 + WAND, -4, MITTE - WAND * 2, KACHEL + 8);
    for (let y = 30; y < KACHEL; y += 60) {
      k.fillStyle = "rgba(70, 90, 140, 0.25)";
      k.beginPath();
      k.ellipse(1.8, y + 2.4, 2.6, 1.6, 0, 0, TAU);
      k.fill();
      k.fillStyle = "#F5A623";
      k.beginPath();
      k.arc(0, y, 2.4, 0, TAU);
      k.fill();
      k.fillStyle = "#ffffff";
      k.beginPath();
      k.arc(-0.5, y - 0.5, 1, 0, TAU);
      k.fill();
    }
    return c;
  }

  function vorrendern() {
    const dunkel = ["#1b4c3a", "#22604a", "#2c7457", "#3f8c69"];
    bilder.boden = bodenMalen();
    bilder.baeume = [27, 32].map((R) => sprite(R * 1.45, (k) => tanneMalen(k, R, dunkel)));
    bilder.tanne = sprite(30, tanneStehendMalen);
    bilder.stein = sprite(20, steinMalen);
    bilder.mann = sprite(31, mannMalen);
    bilder.stern = sprite(15, (k) => sternMalen(k, 11.5, false));
    bilder.sternGrau = sprite(15, (k) => sternMalen(k, 11.5, true));
    bilder.leuchten = sprite(24, (k) => leuchtMalen(k, 24, "rgba(255, 200, 70, 0.6)"));
    bilder.funke = sprite(6, (k) => leuchtMalen(k, 6, "rgba(255, 186, 48, 0.9)"));
    // Der Dunst oben im Bild: so wirkt der Hang tief.
    bilder.dunst = g.createLinearGradient(0, 0, 0, view.cssH * 0.32);
    bilder.dunst.addColorStop(0, "rgba(255, 255, 255, 0.5)");
    bilder.dunst.addColorStop(1, "rgba(255, 255, 255, 0)");
  }

  // ---------------------------------------------------------------------------
  // Teilchen, Striche, Flocken, Schriften
  // ---------------------------------------------------------------------------
  // Ein fester Vorrat: Neue Teilchen überschreiben die ältesten, nichts wird
  // im Lauf angelegt. Ort in der Welt (y voraus), damit Schneestaub liegen
  // bleibt und mit dem Boden nach unten zieht.
  const TEIL_STAUB = 0;
  const TEIL_FUNKE = 1;
  const TEIL_BROCKEN = 2;
  const teile = Array.from({ length: TEILE_MAX }, () => ({ an: false, art: 0, x: 0, y: 0, vx: 0, vy: 0, r: 1, leben: 0, max: 1 }));
  let teilNaechstes = 0;

  function teil(art, x, y, vx, vy, r, leben) {
    const t = teile[teilNaechstes];
    teilNaechstes = (teilNaechstes + 1) % TEILE_MAX;
    t.an = true;
    t.art = art;
    t.x = x;
    t.y = y;
    t.vx = vx;
    t.vy = vy;
    t.r = r;
    t.leben = leben;
    t.max = leben;
  }

  function funken(x, y, n, mit) {
    const v = tempoBei(state.weg) * mit;
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * TAU;
      const sp = 30 + Math.random() * 90;
      teil(TEIL_FUNKE, x, y, Math.cos(w) * sp, v + Math.sin(w) * sp, 1.6 + Math.random() * 1.8, 0.35 + Math.random() * 0.4);
    }
  }

  function schneeBurst(x, y, n) {
    const v = tempoBei(state.weg);
    for (let i = 0; i < n; i += 1) {
      const w = Math.random() * TAU;
      const sp = 40 + Math.random() * 160;
      teil(i % 3 ? TEIL_BROCKEN : TEIL_STAUB, x, y, Math.cos(w) * sp, v * 0.25 + Math.sin(w) * sp, 1.4 + Math.random() * 3.2, 0.5 + Math.random() * 0.7);
    }
  }

  // Tempostriche: helle Linien, die schneller als der Boden nach unten ziehen.
  const STRICHE = Array.from({ length: 22 }, () => ({ an: false, x: 0, y: 0, len: 0 }));
  // Schneefall, im Bild: nah fällt schneller und zieht mit dem Tempo.
  const FLOCKEN = Array.from({ length: 44 }, (_, i) => ({ x: hash01(i * 1.9 + 1), y: hash01(i * 2.7 + 2), z: 0.3 + hash01(i * 3.1 + 3) * 0.7, ph: hash01(i * 4.3 + 4) * TAU }));

  function schrift(text, x, y, farbe, gross, leben) {
    if (state.schriften.length > 12) state.schriften.shift();
    state.schriften.push({ text, x, y, farbe, gross, leben, max: leben });
  }

  // ---------------------------------------------------------------------------
  // Bewegung fürs Bild
  // ---------------------------------------------------------------------------
  function wechselEffekt(sl) {
    sl.spruehen = 0.16;
    tonMitPause("spuren.wechsel", { laut: 0.7 });
    if (ruhig()) return;
    const x = schlittenX(sl);
    const richtung = sl.ziel === 1 ? 1 : -1;
    const v = tempoBei(state.weg);
    for (let i = 0; i < 6; i += 1) {
      teil(TEIL_STAUB, x - richtung * 8, state.weg - 6 + Math.random() * 10, -richtung * (30 + Math.random() * 70), v * (0.55 + Math.random() * 0.25), 1.5 + Math.random() * 1.6, 0.35 + Math.random() * 0.25);
    }
  }

  function schlittenBewegen(dt, v) {
    const viel = ruhig() ? 0.3 : 1;
    for (const sl of state.schlitten) {
      const u = sl.k / K;
      const bewegt = sl.ziel === 1 ? sl.k < K : sl.k > 0;
      const richtung = sl.ziel === 1 ? 1 : -1;
      const m = bewegt ? Math.max(0.4, 4 * u * (1 - u)) : 0;
      const n = Math.min(1, dt * 22);
      sl.neig += (richtung * 0.3 * m - sl.neig) * n;
      sl.quetsch += (0.13 * m - sl.quetsch) * n;
      if (sl.warBewegt && !bewegt) sl.wackel = 1;
      sl.warBewegt = bewegt;
      sl.wackel = Math.max(0, sl.wackel - dt * 3.2);
      sl.spruehen = Math.max(0, sl.spruehen - dt);
      if (sl.crash) sl.dreh += (sl.drehZiel - sl.dreh) * Math.min(1, dt * 7);
      const x = schlittenX(sl);

      // Die Kratzspur der Kufen im Eis
      if (state.phase !== "bereit" && !sl.crash) {
        if (state.weg - sl.spurY > SPUR_ABST * SPUR_N) sl.spurY = state.weg - SPUR_ABST * SPUR_N;
        while (state.weg - sl.spurY >= SPUR_ABST) {
          sl.spurY += SPUR_ABST;
          sl.spur[sl.spurI] = x;
          sl.spurI = (sl.spurI + 1) % SPUR_N;
          sl.spurN = Math.min(SPUR_N, sl.spurN + 1);
        }
      }

      // Schneestaub hinter den Kufen – mehr, je schneller, und eine Fahne
      // nach aussen, solange er die Spur wechselt.
      if (v <= 0 || sl.crash) continue;
      sl.staub += dt * (6 + v * 0.06) * viel;
      while (sl.staub >= 1) {
        sl.staub -= 1;
        const seite = Math.random() < 0.5 ? -6.5 : 6.5;
        teil(TEIL_STAUB, x + seite, state.weg - 14, (Math.random() - 0.5) * 16, v * (0.82 + Math.random() * 0.1), 0.9 + Math.random() * 1.2, 0.3 + Math.random() * 0.25);
      }
      if (bewegt && !ruhig()) {
        const anzahl = dt * 70;
        for (let i = 0; i < anzahl; i += 1) {
          teil(TEIL_STAUB, x - richtung * 7, state.weg - 8 + Math.random() * 12, -richtung * (40 + Math.random() * 80), v * (0.6 + Math.random() * 0.25), 1.2 + Math.random() * 1.8, 0.3 + Math.random() * 0.3);
        }
      }
    }
  }

  function teileBewegen(dt) {
    for (const t of teile) {
      if (!t.an) continue;
      t.leben -= dt;
      if (t.leben <= 0) { t.an = false; continue; }
      const reib = t.art === TEIL_FUNKE ? 2.2 : t.art === TEIL_BROCKEN ? 3.4 : 4.2;
      const f = Math.max(0, 1 - reib * dt);
      t.vx *= f;
      t.vy *= f;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
    }
  }

  function stricheBewegen(dt, v) {
    const dichte = ruhig() ? 0 : clamp((v - 175) / 150, 0, 1);
    const tempo = v * view.s * 1.8;
    for (const st of STRICHE) {
      if (st.an) {
        st.y += tempo * dt;
        if (st.y - st.len > view.cssH) st.an = false;
        continue;
      }
      if (dichte > 0 && Math.random() < dt * 7 * dichte) {
        st.an = true;
        st.x = Math.random() * view.cssW;
        st.len = (18 + Math.random() * 40) * (0.5 + dichte) * view.s * 0.6;
        st.y = -Math.random() * 40;
      }
    }
  }

  function flockenBewegen(dt, v) {
    const H = Math.max(1, view.cssH);
    const W = Math.max(1, view.cssW);
    for (const f of FLOCKEN) {
      const vy = (26 + 46 * f.z) + v * view.s * 0.22 * f.z;
      f.y += (vy * dt) / H;
      f.x += (Math.sin(state.zeit * 1.3 + f.ph) * 12 * f.z * dt) / W;
      if (f.y > 1.03) { f.y -= 1.06; f.x = Math.random(); }
      if (f.x < -0.02) f.x += 1.04;
      if (f.x > 1.02) f.x -= 1.04;
    }
  }

  function effekte(dt) {
    state.zeit += dt;
    if (state.fehler) nachlauf(dt);
    const lupe = state.fehler ? state.lupe : 1;
    const v = state.phase === "bereit" ? 0 : tempoBei(state.weg) * lupe;
    state.stoss = Math.max(0, state.stoss - dt * 2.2);
    state.puls = Math.max(0, state.puls - dt * 5);
    state.glanz = Math.max(0, state.glanz - dt * 1.2);
    schlittenBewegen(dt, v);
    teileBewegen(dt * Math.max(lupe, 0.25));
    stricheBewegen(dt, v);
    flockenBewegen(dt, state.phase === "bereit" ? 0 : v);
    for (let i = state.schriften.length - 1; i >= 0; i -= 1) {
      const s = state.schriften[i];
      s.leben -= dt;
      if (s.leben <= 0) state.schriften.splice(i, 1);
    }
    for (const d of state.dinge) if (d.wackel > 0) d.wackel = Math.max(0, d.wackel - dt * 2.5);
    aufraeumen();
    kufenStellen();
  }

  // Was weit hinter den Bobs liegt, fällt aus den Listen.
  function aufraeumen() {
    const grenze = state.weg - view.hinten - 120;
    let n = 0;
    while (n < state.erstes && state.dinge[n].y < grenze) n += 1;
    if (n > 8) {
      state.dinge.splice(0, n);
      state.erstes -= n;
    }
    while (state.zeilen.length && state.zeilen[0].y < grenze) state.zeilen.shift();
  }

  // ---------------------------------------------------------------------------
  // Zeichnen
  // ---------------------------------------------------------------------------
  // Die Kamera: beim Fehler fährt sie heran, auf die Stelle, und rückt sie ein
  // Stück zur Mitte; ein Stoss lässt sie kurz zittern.
  function kameraRechnen() {
    let z = 1;
    let ex = 0;
    let ey = 0;
    const f = state.fehler;
    if (f) {
      const k = raus(clamp(f.zeit / 0.5, 0, 1));
      z = 1 + ((ruhig() ? 1.25 : 1.65) - 1) * k;
      const fx = bx(f.x);
      const fy = by(f.y);
      const zielX = lerp(fx, view.mx, 0.45 * k);
      const zielY = lerp(fy, view.frei + (view.cssH - view.frei) * 0.52, 0.45 * k);
      ex = zielX - fx * z;
      ey = zielY - fy * z;
    }
    if (state.stoss > 0 && !ruhig()) {
      ex += Math.sin(state.zeit * 63) * 6 * state.stoss;
      ey += Math.cos(state.zeit * 51) * 5 * state.stoss;
    }
    cam.z = z;
    cam.ex = ex;
    cam.ey = ey;
  }

  function kamera() {
    g.setTransform(view.dpr * cam.z, 0, 0, view.dpr * cam.z, cam.ex * view.dpr, cam.ey * view.dpr);
  }

  function bildschirm() {
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }

  // Der Boden: die Kachel, Bildpunkt auf Bildpunkt kopiert – nur beim Zoom
  // nach einem Fehler gestreckt, dann aber mit genau derselben Verschiebung.
  function zeichneBoden() {
    const b = bilder.boden;
    if (!b) return;
    const H = b.height;
    const versatz = Math.round(state.weg * view.s * b.dpr) % H;
    if (cam.z === 1 && b.dpr === view.dpr && b.width === canvas.width) {
      g.setTransform(1, 0, 0, 1, Math.round(cam.ex * view.dpr), Math.round(cam.ey * view.dpr));
      for (let y = versatz - H; y < canvas.height + 2; y += H) g.drawImage(b, 0, y);
      kamera();
      return;
    }
    const hoch = H / b.dpr;
    for (let y = (versatz - H) / b.dpr; y < view.cssH + 8; y += hoch) g.drawImage(b, 0, y, view.cssW, hoch);
  }

  // Die Kratzspuren der Kufen hinter den Bobs, nach hinten blasser.
  function zeichneSpuren() {
    const s = view.s;
    const lang = SPUR_N * SPUR_ABST * s;
    const v = g.createLinearGradient(0, view.sy, 0, view.sy + lang);
    v.addColorStop(0, "rgba(95, 140, 190, 0.55)");
    v.addColorStop(1, "rgba(95, 140, 190, 0)");
    g.strokeStyle = v;
    g.lineWidth = Math.max(1, s * 0.7);
    g.lineJoin = "round";
    for (const sl of state.schlitten) {
      if (!sl.spurN) continue;
      const x = schlittenX(sl);
      for (const kufe of [-6.5, 6.5]) {
        g.beginPath();
        g.moveTo(bx(x + kufe), view.sy + sl.rueck * s + 10 * s);
        for (let j = 0; j < sl.spurN; j += 1) {
          const i = (sl.spurI - 1 - j + SPUR_N * 2) % SPUR_N;
          const yw = sl.spurY - j * SPUR_ABST;
          g.lineTo(bx(sl.spur[i] + kufe), by(yw) + 10 * s);
        }
        g.stroke();
      }
    }
  }

  function zeichneStriche() {
    if (ruhig()) return;
    g.strokeStyle = "rgba(130, 168, 214, 0.42)";
    g.lineWidth = 1.2;
    g.lineCap = "round";
    g.beginPath();
    let da = false;
    for (const st of STRICHE) {
      if (!st.an) continue;
      g.moveTo(st.x, st.y - st.len);
      g.lineTo(st.x, st.y);
      da = true;
    }
    if (da) g.stroke();
  }

  // Ein Doppeltipp kündigt sich an: eine goldene Linie quer über beide Kanäle.
  function zeichneDoppel() {
    const s = view.s;
    for (const z of state.zeilen) {
      if (z.bonus || z.y > state.weg + view.vorn + 30 || z.y < state.weg - 30) continue;
      const y = by(z.y);
      let links = Infinity;
      let rechts = -Infinity;
      z.dinge.forEach((d) => {
        const x = spurX(d.bahn, d.spur);
        links = Math.min(links, x);
        rechts = Math.max(rechts, x);
      });
      const puls = 0.55 + 0.25 * Math.sin(state.zeit * 6 + z.id);
      g.strokeStyle = `rgba(245, 166, 35, ${puls.toFixed(3)})`;
      g.lineWidth = Math.max(1.5, s * 1.3);
      g.setLineDash([5 * s, 4 * s]);
      g.beginPath();
      g.moveTo(bx(links), y);
      g.lineTo(bx(rechts), y);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "#F5A623";
      g.beginPath();
      g.moveTo(view.mx, y - 5 * s);
      g.lineTo(view.mx + 5 * s, y);
      g.lineTo(view.mx, y + 5 * s);
      g.lineTo(view.mx - 5 * s, y);
      g.closePath();
      g.fill();
    }
  }

  function zeichneDinge() {
    const oben = state.weg + view.vorn + 40;
    const unten = state.weg - view.hinten - 40;
    const s = view.s;
    // Erst das Leuchten der Sterne, aufaddiert
    g.globalCompositeOperation = "lighter";
    for (const d of state.dinge) {
      if (d.y > oben) break;
      if (d.y < unten || d.art !== "stern" || d.zustand !== "offen") continue;
      bildMalen(bilder.leuchten, bx(spurX(d.bahn, d.spur)), by(d.y), 0.85 + 0.15 * Math.sin(state.zeit * 4 + d.ph));
    }
    g.globalCompositeOperation = "source-over";
    for (const d of state.dinge) {
      if (d.y > oben) break;
      if (d.y < unten || d.zustand === "genommen") continue;
      let x = bx(spurX(d.bahn, d.spur));
      const y = by(d.y);
      if (d.wackel > 0) x += Math.sin(state.zeit * 55) * 3 * d.wackel * s;
      if (d.art === "stern") {
        const grau = d.zustand === "verpasst";
        g.save();
        g.translate(x, y);
        g.rotate(grau ? 0 : Math.sin(state.zeit * 2.2 + d.ph) * 0.3);
        const mal = grau ? 0.9 : 1 + 0.07 * Math.sin(state.zeit * 5 + d.ph);
        bildMalen(grau ? bilder.sternGrau : bilder.stern, 0, 0, mal);
        g.restore();
      } else {
        bildMalen(bilder[d.art], x, y);
      }
    }
  }

  function zeichneTeile(funkeln) {
    const s = view.s;
    if (funkeln) {
      g.globalCompositeOperation = "lighter";
      for (const t of teile) {
        if (!t.an || t.art !== TEIL_FUNKE) continue;
        const k = t.leben / t.max;
        g.globalAlpha = k;
        bildMalen(bilder.funke, bx(t.x), by(t.y), t.r * (0.3 + k * 0.35));
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
      return;
    }
    for (const t of teile) {
      if (!t.an || t.art === TEIL_FUNKE) continue;
      const k = t.leben / t.max;
      const x = bx(t.x);
      const y = by(t.y);
      const r = t.r * s * (t.art === TEIL_STAUB ? 1.7 - k * 0.7 : 0.6 + k * 0.4);
      g.globalAlpha = Math.min(1, k * 1.4) * (t.art === TEIL_STAUB ? 0.85 : 1);
      g.fillStyle = t.art === TEIL_STAUB ? "#bfd3ea" : "#d7e4f3";
      g.beginPath();
      g.arc(x + r * 0.25, y + r * 0.3, r, 0, TAU);
      g.fill();
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(x, y, r * 0.88, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }

  // Ein Bob von oben, die Nase voraus (im Bild oben): Kufen, Rumpf in seiner
  // Farbe, darin der Fahrer mit Helm und einem Schal, der im Fahrtwind flattert.
  const BOB = [
    { hell: "#ff8f8a", mitte: "#ec4646", dunkel: "#a3222a", helm: "#c3262f" },
    { hell: "#95c2ff", mitte: "#2f7be6", dunkel: "#1a479a", helm: "#1f5fc6" },
  ];

  function zeichneSchlitten(sl) {
    const s = view.s;
    const farbe = BOB[sl.bahn];
    const x = bx(schlittenX(sl));
    const warte = state.phase === "bereit" && !ruhig() ? Math.sin(state.zeit * 3.2 + sl.bahn * 1.7) * 0.8 : 0;
    const y = view.sy + (sl.rueck + warte) * s;
    const wack = sl.wackel > 0 ? Math.sin(sl.wackel * 18) * 0.07 * sl.wackel : 0;
    g.save();
    g.translate(x, y);
    g.rotate(sl.neig + sl.dreh);
    g.scale(s * (1 + sl.quetsch + wack), s * (1 - sl.quetsch * 0.6 - wack * 0.5));

    g.fillStyle = "rgba(45, 65, 115, 0.22)";
    g.beginPath();
    g.ellipse(2.6, 3.6, 9.8, 16.8, 0, 0, TAU);
    g.fill();

    // Kufen
    g.strokeStyle = "#353c4c";
    g.lineWidth = 1.6;
    g.lineCap = "round";
    [-1, 1].forEach((seite) => {
      g.beginPath();
      g.moveTo(seite * 7.3, 14.5);
      g.lineTo(seite * 7.3, -10);
      g.quadraticCurveTo(seite * 7.3, -16.8, seite * 3.4, -16.8);
      g.stroke();
    });

    // Rumpf
    if (!sl.fuellung) {
      const v = g.createLinearGradient(-8, 0, 8, 0);
      v.addColorStop(0, farbe.hell);
      v.addColorStop(0.45, farbe.mitte);
      v.addColorStop(1, farbe.dunkel);
      sl.fuellung = v;
    }
    g.fillStyle = sl.fuellung;
    g.beginPath();
    g.moveTo(0, -16.2);
    g.bezierCurveTo(6.6, -15.6, 8, -9, 8, -3);
    g.lineTo(7.6, 11);
    g.quadraticCurveTo(7.4, 14.6, 4, 14.6);
    g.lineTo(-4, 14.6);
    g.quadraticCurveTo(-7.4, 14.6, -7.6, 11);
    g.lineTo(-8, -3);
    g.bezierCurveTo(-8, -9, -6.6, -15.6, 0, -16.2);
    g.closePath();
    g.fill();
    // Rennstreifen auf der Nase
    g.fillStyle = "rgba(255, 255, 255, 0.9)";
    g.beginPath();
    g.moveTo(-1.5, -15.8);
    g.lineTo(1.5, -15.8);
    g.lineTo(1.7, -6);
    g.lineTo(-1.7, -6);
    g.closePath();
    g.fill();
    // Das Cockpit
    g.fillStyle = "#262b38";
    g.beginPath();
    g.ellipse(0, 3.4, 5.5, 8.4, 0, 0, TAU);
    g.fill();

    // Der Schal, im Fahrtwind
    const welle = Math.sin(state.zeit * 18 + sl.bahn * 2) * 1.6;
    g.strokeStyle = "#F5A623";
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(1.6, 5.2);
    g.quadraticCurveTo(3.4 + welle, 10.5, 2 - welle * 0.8, 16.5);
    g.stroke();

    // Fahrer: Schultern und Helm mit Visier nach vorn
    g.fillStyle = "#2b3756";
    g.beginPath();
    g.ellipse(0, 5.3, 6, 3.4, 0, 0, TAU);
    g.fill();
    g.fillStyle = farbe.helm;
    g.beginPath();
    g.arc(0, 1.3, 4.4, 0, TAU);
    g.fill();
    g.fillStyle = "rgba(255, 255, 255, 0.45)";
    g.beginPath();
    g.arc(-1.3, 0.2, 1.6, 0, TAU);
    g.fill();
    g.strokeStyle = "#151a26";
    g.lineWidth = 1.7;
    g.beginPath();
    g.arc(0, 1.3, 4.1, -2.55, -0.6);
    g.stroke();
    g.restore();
  }

  // Einzelne hohe Tannen am Rand: Ihre Kronen sind näher an der Kamera als
  // der Boden und ziehen darum schneller vorbei (Parallaxe). Nur, wo neben
  // den Kanälen Platz ist – hochkant stünden sie auf den Wänden.
  const BAUM_ABST = 70;
  const PARALLAXE = 1.3;

  function zeichneBaeume() {
    if (view.halb < RAND + 40) return;
    const s = view.s;
    const weg = state.weg * PARALLAXE;
    const von = Math.floor((weg - view.hinten - 80) / BAUM_ABST);
    const bis = Math.ceil((weg + view.vorn + 80) / BAUM_ABST);
    for (let i = von; i <= bis; i += 1) {
      for (let seite = -1; seite <= 1; seite += 2) {
        if (hash01(i * 3.77 + seite * 1.3) < 0.3) continue;
        const gross = hash01(i * 2.3 + seite * 4.4) < 0.5 ? 0 : 1;
        const R = gross ? 32 : 27;
        const innen = RAND + 6 + R;
        const xw = seite * (innen + hash01(i * 7.1 + seite * 0.7) * Math.max(0, view.halb + R * 0.4 - innen));
        const yw = i * BAUM_ABST + hash01(i * 5.9 + seite) * BAUM_ABST * 0.6;
        bildMalen(bilder.baeume[gross], view.mx + xw * s, view.sy - (yw - weg) * s);
      }
    }
  }

  // Der Fehler: ein roter Ring um das, woran es lag.
  function zeichneFehlerRing() {
    const f = state.fehler;
    if (!f) return;
    const s = view.s;
    const x = bx(f.x);
    const y = by(f.y);
    const k = clamp(f.zeit / 0.25, 0, 1);
    const r = (17 + 3 * Math.sin(state.zeit * 9)) * s * (1.6 - 0.6 * k);
    g.globalAlpha = k;
    g.strokeStyle = "rgba(255, 255, 255, 0.9)";
    g.lineWidth = Math.max(3, 3.6 * s) / cam.z * 1.4;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.stroke();
    g.strokeStyle = "#e5383b";
    g.lineWidth = Math.max(2, 2.2 * s) / cam.z * 1.4;
    g.stroke();
    g.globalAlpha = 1;
  }

  function zeichneFlocken() {
    const W = view.cssW;
    const H = view.cssH;
    g.fillStyle = "rgba(120, 145, 190, 0.22)";
    g.beginPath();
    for (const f of FLOCKEN) {
      const r = 0.7 + f.z * 1.8;
      g.moveTo(f.x * W + 1 + r, f.y * H + 1);
      g.arc(f.x * W + 1, f.y * H + 1, r, 0, TAU);
    }
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    for (const f of FLOCKEN) {
      const r = 0.7 + f.z * 1.8;
      g.moveTo(f.x * W + r, f.y * H);
      g.arc(f.x * W, f.y * H, r, 0, TAU);
    }
    g.fill();
  }

  function zeichneSchriften() {
    if (!state.schriften.length) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    const basis = clamp(view.s * 10, 13, 24);
    state.schriften.forEach((t) => {
      const k = clamp(t.leben / t.max, 0, 1);
      const auf = 1 - k;
      const pop = auf < 0.15 ? 0.6 + auf / 0.15 * 0.55 : auf < 0.3 ? 1.15 - (auf - 0.15) / 0.15 * 0.15 : 1;
      const gross = Math.round(basis * t.gross * pop);
      g.globalAlpha = Math.min(1, k * 2.5);
      g.font = `900 ${gross}px system-ui, sans-serif`;
      g.lineWidth = Math.max(3, gross * 0.2);
      g.lineJoin = "round";
      g.strokeStyle = "rgba(28, 40, 74, 0.75)";
      const y = t.y - auf * 30;
      g.strokeText(t.text, t.x, y);
      g.fillStyle = t.farbe;
      g.fillText(t.text, t.x, y);
    });
    g.globalAlpha = 1;
  }

  // Was beim Fehler gross dasteht: woran es lag.
  function zeichneFehlerText() {
    const f = state.fehler;
    if (!f || f.zeit < 0.06) return;
    const x = clamp(bx(f.x) * cam.z + cam.ex, 90, view.cssW - 90);
    const y = Math.max(view.frei + 40, (by(f.y) - 34 * view.s) * cam.z + cam.ey);
    const k = clamp((f.zeit - 0.06) / 0.22, 0, 1);
    const pop = k < 0.6 ? 0.5 + k / 0.6 * 0.7 : 1.2 - (k - 0.6) / 0.4 * 0.2;
    const gross = Math.round(clamp(view.s * 15, 22, 40) * pop);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `900 ${gross}px system-ui, sans-serif`;
    g.lineJoin = "round";
    g.lineWidth = Math.max(4, gross * 0.22);
    g.strokeStyle = "rgba(28, 40, 74, 0.85)";
    g.strokeText(f.text, x, y);
    g.fillStyle = f.art === "stern" ? "#ffd23f" : "#ffffff";
    g.fillText(f.text, x, y);
  }

  // Vor dem ersten Tipp: ein Pfeil neben jedem Bob, in seiner Farbe – hier
  // wird gewechselt.
  function zeichneBereit() {
    if (state.phase !== "bereit") return;
    const s = view.s;
    const k = 0.5 + 0.5 * Math.sin(state.zeit * 4);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const sl of state.schlitten) {
      const x = bx(spurX(sl.bahn, 0.5));
      const y = view.sy;
      const richtung = sl.ziel === 1 ? -1 : 1;
      const spitze = x + richtung * (3 + k * 4) * s;
      g.beginPath();
      g.moveTo(spitze - richtung * 6 * s, y - 7 * s);
      g.lineTo(spitze, y);
      g.lineTo(spitze - richtung * 6 * s, y + 7 * s);
      g.strokeStyle = "rgba(255, 255, 255, 0.95)";
      g.lineWidth = Math.max(4, 4.4 * s);
      g.stroke();
      g.strokeStyle = BOB[sl.bahn].mitte;
      g.lineWidth = Math.max(2, 2.2 * s);
      g.stroke();
    }
  }

  // Die Sterne oben links – die Zahl der Runde.
  function zeichneAnzeige() {
    bildschirm();
    // Auf dem Handy liegt der obere Rand unter den Knöpfen: dann darunter.
    g.translate(0, shell?.frei?.(canvas) || 0);
    const gross = clamp(view.cssH * 0.05, 14, 24);
    const text = String(state.punkte);
    g.font = `900 ${Math.round(gross)}px system-ui, sans-serif`;
    g.textAlign = "left";
    g.textBaseline = "middle";
    const tw = g.measureText(text).width;
    const h = gross * 1.6;
    const w = tw + gross * 2.4;
    const x = 12;
    const y = 12;
    const mal = 1 + 0.12 * state.puls;
    g.translate(x + h / 2, y + h / 2);
    g.scale(mal, mal);
    g.translate(-(x + h / 2), -(y + h / 2));
    if (state.glanz > 0) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = state.glanz;
      bildMalen(bilder.leuchten, x + w / 2, y + h / 2, (w / view.s) / 40 + 0.4);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    }
    g.fillStyle = "rgba(24, 36, 72, 0.62)";
    g.beginPath();
    if (g.roundRect) g.roundRect(x, y, w, h, h / 2);
    else g.rect(x, y, w, h);
    g.fill();
    g.fillStyle = "#ffcf33";
    sternPfad(g, x + gross * 0.95, y + h / 2, gross * 0.55, gross * 0.25);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillText(text, x + gross * 1.75, y + h * 0.52);
  }

  function zeichnen() {
    if (!g) return;
    kameraRechnen();
    if (cam.ex || cam.ey || cam.z !== 1) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = "#eef3f8";
      g.fillRect(0, 0, canvas.width, canvas.height);
    }
    kamera();
    zeichneBoden();
    zeichneSpuren();
    zeichneStriche();
    zeichneDoppel();
    zeichneDinge();
    zeichneTeile(false);
    zeichneSchlitten(state.schlitten[0]);
    zeichneSchlitten(state.schlitten[1]);
    zeichneTeile(true);
    zeichneFehlerRing();
    zeichneBaeume();
    bildschirm();
    zeichneFlocken();
    g.fillStyle = bilder.dunst;
    g.fillRect(0, 0, view.cssW, view.cssH * 0.32);
    zeichneSchriften();
    zeichneBereit();
    zeichneFehlerText();
    zeichneAnzeige();
  }

  // ---------------------------------------------------------------------------
  // Die Schleife
  // ---------------------------------------------------------------------------
  // Die Fahrt folgt der echten Zeit seit dem Start (losMs) in festen
  // Schritten – so passen die Züge, die mit der echten Zeit aufgezeichnet
  // werden, zur Fahrt. Hängt ein Bild (oder war die Seite verborgen), holt
  // sie höchstens AUFHOLEN_MAX Schritte auf; der Rest fällt weg, statt die
  // Bobs blind in den nächsten Baum zu schieben.
  function aufholen() {
    if (state.phase !== "spiel") return;
    let soll = Math.floor((performance.now() - state.losMs) / (TAKT * 1000));
    if (soll - state.tick > AUFHOLEN_MAX) {
      state.losMs += (soll - state.tick - AUFHOLEN_MAX) * TAKT * 1000;
      soll = state.tick + AUFHOLEN_MAX;
    }
    while (state.tick < soll && state.phase === "spiel") simSchritt();
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

  // Für die Prüfskripte: ein Schritt ohne requestAnimationFrame. Die Fahrt
  // rückt genau um dt vor (losMs wandert mit, sonst holte die Schleife sie
  // danach auf die echte Zeit zurück).
  function takt(dt) {
    const h = clamp(Number(dt) || 0, 0, 0.05);
    if (state.phase === "spiel") {
      state.uhrRest += h;
      const n = Math.floor(state.uhrRest / TAKT + 1e-6);
      state.uhrRest = Math.max(0, state.uhrRest - n * TAKT);
      state.losMs -= n * TAKT * 1000;
      for (let i = 0; i < n && state.phase === "spiel"; i += 1) simSchritt();
      if (state.phase === "spiel") gegner?.takt(state.punkte);
    } else if (state.phase === "zuschauen") zuschauenTakt();
    effekte(h);
  }

  // ---------------------------------------------------------------------------
  // Tippen
  // ---------------------------------------------------------------------------
  // Die Runde beginnt: mit dem ersten Tipp – oder im Live-Modus zum
  // gemeinsamen Start (game-shell.js, live.los).
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
    state.schlitten.forEach((sl) => { sl.spurY = state.weg; sl.wackel = 1; });
    kufenAn();
  }

  // Ein Tipp auf eine Seite (0 oder "links", 1 oder "rechts"). Der erste
  // Tipp startet nur – erst danach wechselt jeder Tipp die Spur.
  function tippe(seite) {
    const bahn = seite === 1 || seite === "rechts" ? 1 : 0;
    if (state.phase === "bereit") {
      if (shell.live) return;
      losGehts();
      return;
    }
    if (state.phase !== "spiel") return;
    const sl = state.schlitten[bahn];
    sl.ziel = 1 - sl.ziel;
    sl.wechselTick = state.tick;
    wechselEffekt(sl);
    brumm(6);
    meldeZug(ZUG_WECHSEL);
  }

  // ---------------------------------------------------------------------------
  // Im Multiplayer und in der Hall of Fame: Zug um Zug
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (geist.js, zuege; live-spiel.js, zug) – sofort, wenn etwas
   * geschieht, mit dem ganzen Stand:
   *
   *   a   der Schritt der Fahrt (TAKT), in dem es geschah
   *   b   wohin die Bobs fahren: links + 2 × rechts (je 0 oder 1)
   *   c   was: 0 Start, 1 Spurwechsel; beim Ende 2–5 (Hindernis links,
   *       rechts, Stern links, rechts) + 8 × die Nummer des Dings
   *   p   die Punkte bis dahin
   *
   * Wer zuschaut, hat dieselben Reihen (dieselbe Saat) und setzt jeden Zug in
   * genau seinem Schritt ein – dazwischen rechnet er dieselben Schritte wie
   * damals. Zwei Züge, die im Multiplayer zu einem werden, gehen nicht
   * verloren: Jeder sagt, wohin beide Bobs fahren.
   */
  const zieleB = () => state.schlitten[0].ziel + 2 * state.schlitten[1].ziel;

  function meldeZug(art, dingId = 0) {
    if (state.phase === "zuschauen") return;
    const ort = { a: state.tick, b: zieleB(), c: art >= ZUG_HINDERNIS ? dingId * 8 + art : art };
    aufnahme?.zug(state.punkte, ort);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, ort);
  }

  function zielSetzen(bahn, ziel) {
    const sl = state.schlitten[bahn];
    if (sl.ziel === ziel) return;
    sl.ziel = ziel;
    sl.wechselTick = state.tick;
    wechselEffekt(sl);
  }

  function zugAnwenden(z) {
    const art = z.c % 8;
    if (art !== ZUG_START) {
      zielSetzen(0, z.b & 1);
      zielSetzen(1, (z.b >> 1) & 1);
    }
    if (art >= ZUG_HINDERNIS && !state.fehler) {
      const id = Math.floor(z.c / 8);
      const d = state.dinge.find((x) => x.id === id);
      if (d) fehlerBeginnt(d);
    }
    if (Number.isFinite(z.p) && z.p !== state.punkte) state.punkte = z.p;
  }

  // Jedes Bild: die Züge, die inzwischen da sind (beim Anschauen aus der
  // Hall of Fame alle, im Multiplayer, was angekommen ist), und so viele
  // Schritte, wie der andere zu dieser Zeit gefahren war – geschätzt vom
  // letzten Zug aus, der schon vorbei ist.
  function zuschauenTakt() {
    if (!zuschauer?.seit) return;
    const jetzt = zuschauer.jetzt();
    const neu = zuschauer.seit(gesehenBis, Infinity);
    for (const z of neu) {
      gesehenBis = z.t;
      zugListe.push(z);
    }
    while (zugAnker + 1 < zugListe.length && zugListe[zugAnker + 1].t <= jetzt) zugAnker += 1;
    const anker = zugListe[zugAnker];
    const verzug = zuschauer.live ? 24 : 4;
    const ziel = Math.floor(anker ? anker.a + (jetzt - anker.t) * 0.24 : jetzt * 0.24) - verzug;
    const anwenden = () => {
      while (zugNaechster < zugListe.length && zugListe[zugNaechster].a <= state.tick) {
        zugAnwenden(zugListe[zugNaechster]);
        zugNaechster += 1;
      }
    };
    anwenden();
    for (let n = 0; n < 480 && state.tick < ziel && !state.fehler; n += 1) {
      simSchritt();
      anwenden();
    }
    punkteZeigen();
    // Eine Fahrt aus der Hall of Fame: am Schluss die Tafel – und die Kufen
    // schweigen, wie auch immer die Fahrt endete.
    zuschauer.weiter?.();
    if (zuschauer.fertig?.()) kufenAus();
  }

  // Ab jetzt die Fahrt des anderen: von vorn, mit derselben Welt (dieselbe
  // Saat), und dann Zug um Zug, wie er gefahren ist.
  function zuschauenStarten() {
    if (!zuschauer?.lauf || !zuschauer.seit) return;
    startRun();
    state.phase = "zuschauen";
    shell.setPhase("play");
    gesehenBis = -Infinity;
    zugListe = [];
    zugNaechster = 0;
    zugAnker = -1;
    state.schlitten.forEach((sl) => { sl.spurY = state.weg; });
    zuschauer.los?.();
    kufenAn();
    zuschauenTakt();
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    stopLoop();
    kufenAus();
    doppelReihe = 0;
    doppelZeile = -9;
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("intro");
    state.phase = "bereit";
    state.tick = 0;
    state.weg = 0;
    state.punkte = 0;
    state.sterne = 0;
    state.doppel = 0;
    state.losMs = 0;
    state.uhrRest = 0;
    state.schlitten = [neuerSchlitten(0), neuerSchlitten(1)];
    state.dinge = [];
    state.erstes = 0;
    state.zeilen = [];
    state.plan = neuerPlan();
    state.fehler = null;
    state.fertig = false;
    state.lupe = 1;
    state.stoss = 0;
    state.puls = 0;
    state.glanz = 0;
    state.schriften = [];
    teile.forEach((t) => { t.an = false; });
    STRICHE.forEach((st) => { st.an = false; });
    gezeigt = -1;
    punkteZeigen();
    gegner?.runde();
    planBis(VORLAUF + 900);

    shell.clear();
    prompt = buildPrompt();
    shell.play.append(prompt, buildFeld());
    view.cssW = 0;
    view.cssH = 0;
    messen();

    last = performance.now();
    frame = window.requestAnimationFrame(loop);
  }

  function runsGrund() {
    const f = state.fehler;
    if (!f) return "";
    return f.art === "stern" ? "Stern verpasst" : `${NAMEN[f.art]} erwischt`;
  }

  // Die Zahl auf der Tafel läuft von null hoch.
  function zaehleHoch(ziel) {
    const zahl = host.querySelector(".cm-result-score");
    if (!zahl) return;
    if (ruhig() || ziel <= 1) { zahl.textContent = String(ziel); return; }
    const dauer = Math.min(800, 160 + ziel * 12);
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
    if (state.fertig) return;
    state.fertig = true;
    state.phase = "ende";
    stopLoop();
    kufenAus();
    if (g) zeichnen();
    const punkte = state.punkte;
    const geist = aufnahme?.ende(gegner?.ende(punkte) || null) || null;
    const vorher = Number(store.read()?.scores?.[0]) || 0;
    const rekord = punkte > vorher;
    recordRun(punkte);
    const grund = runsGrund();
    const teileText = [grund, vorher ? `Bestwert ${vorher}` : ""].filter(Boolean).join(" · ");
    shell.showResult({
      label: "Deine Punkte",
      points: punkte,
      detail: rekord ? "Neuer Rekord!" : teileText || null,
      geist,
    });
    if (rekord) host.querySelector(".cm-result-detail")?.classList.add("zs-rekord");
    zaehleHoch(punkte);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Kein Erklärbild und kein Startknopf: Die Bobs stehen am Start, und der
  // erste Tipp schickt sie los.
  shell = shellApi.mount({
    host,
    title: "Zwei Spuren",
    area: "geschwindigkeit",
    accent: "#F5A623",
    accentDark: "#b9741a",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    live: { los: losGehts, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "twinLanes", fassung: "t1", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "twinLanes", host, art: "tempo" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "t1", zufall }) || null;
  }

  startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  // --- Eingabe ---------------------------------------------------------------
  // Getippt wird auf der ganzen Bühne, die linke Hälfte für den roten Bob,
  // die rechte für den blauen – jeder Finger für sich (pointerdown je
  // Zeiger), mit zwei Fingern also beide zugleich. Nur Knöpfe bleiben Knöpfe.
  // Vor dem Tipp holt die Fahrt bis jetzt auf: Der Wechsel gilt in dem
  // Schritt, in dem der Finger kam, nicht im letzten Bild.
  function seiteBei(clientX) {
    const r = host.getBoundingClientRect();
    return clientX < r.left + r.width / 2 ? 0 : 1;
  }

  host.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a, input")) return;
    aufholen();
    tippe(seiteBei(event.clientX));
  });

  // A oder Pfeil links für den roten, L oder Pfeil rechts für den blauen.
  // Leertaste und Enter starten nur. Steht der Fokus auf einem Knopf, gilt
  // die Taste dem Knopf.
  document.addEventListener("keydown", (event) => {
    const links = event.code === "KeyA" || event.key === "ArrowLeft";
    const rechts = event.code === "KeyL" || event.key === "ArrowRight";
    const start = event.key === " " || event.key === "Enter";
    if (!links && !rechts && !start) return;
    if (document.activeElement?.tagName === "BUTTON") return;
    event.preventDefault();
    if (event.repeat) return;
    if (start) {
      if (state.phase === "bereit" && !shell.live) losGehts();
      return;
    }
    aufholen();
    tippe(links ? 0 : 1);
  });

  window.addEventListener("resize", messen);
  window.addEventListener("orientationchange", messen);
  window.addEventListener("pagehide", () => { clearStep(); stopLoop(); kufenAus(); });

  // Für die Prüfskripte: der Zustand, ein Schritt ohne Bild (takt), Tippen
  // (tippe("links") / tippe("rechts")), die Welt (welt, planBis) und was in
  // einem Kanal als Nächstes kommt (naechste) – mit der Spur, die es
  // verlangt (soll).
  function naechste(bahn) {
    const b = bahn === 1 || bahn === "rechts" ? 1 : 0;
    planBis(state.weg + 900);
    for (let i = state.erstes; i < state.dinge.length; i += 1) {
      const d = state.dinge[i];
      if (d.bahn !== b || d.zustand !== "offen") continue;
      return { id: d.id, y: d.y, ab: d.y - state.weg, spur: d.spur, art: d.art, soll: d.art === "stern" ? d.spur : 1 - d.spur };
    }
    return null;
  }

  window.LernappSpuren = {
    TAKT, SPUR, K, TREFF_L, STERN_L, VORLAUF,
    state, view, takt, tippe, naechste, planBis, tempoBei, schwereBei, abstandBei, spurX,
    welt: () => state.dinge,
  };
})();
