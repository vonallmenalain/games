/*
 * kacheln.js – Kacheln-Knobeln als eine Runde ohne Uhr.
 *
 * Ein Raster aus Kacheln. Ein paar davon leuchten kurz auf; danach sind alle
 * wieder gleich, und das Kind tippt die aufgeleuchteten nach. Stimmt alles,
 * kommt ein grösseres Muster – Runde für Runde eine Kachel mehr. Ein Fehltipp
 * beendet den Lauf. Was zählt, ist, wie viele Kacheln bis dahin richtig
 * getippt wurden.
 *
 * Genau wie bei den Strand-Schätzen: kein Zeitdruck beim Tippen, ein Punkt je
 * richtiger Kachel, eine Bestenliste am Schluss. Die Schwierigkeit kommt aus
 * dem wachsenden Muster, nicht aus einer laufenden Uhr.
 *
 * Bühne, Knöpfe und Bestenliste kommen aus game-shell.js; hier steht nur die
 * Regel.
 */
(() => {
  "use strict";

  if (document.body.dataset.page !== "tiles") return;

  const host = document.querySelector("#kk-stage");
  const shellApi = window.LernappGameShell;
  const cloudApi = window.LernappGameCloud;
  if (!host || !shellApi) return;

  const kids = () => window.LernappKids || null;
  const klang = () => window.ArcadeKlang || null;

  // Der Zufall. Ohne Turnier in der Adresse ist das Math.random; in einem
  // Turnier leuchten für alle dieselben Kacheln (zufall.js).
  const zufall = window.LernappZufall?.fuer?.("tileMemory") || {
    fest: false, neu() {}, zahl: Math.random,
    ganz: (n) => Math.floor(Math.random() * n),
  };

  // ---------------------------------------------------------------------------
  // Regeln
  // ---------------------------------------------------------------------------
  // Eine Kachel mehr je Runde, und das Raster wächst mit: liegen die Kacheln zu
  // dicht, merkt man sich ein Muster statt einzelner Plätze – das ist eine
  // andere Aufgabe und eine deutlich leichtere.
  //
  // Als Tabelle und nicht als Formel, damit sich die Kurve später von Hand
  // nachziehen lässt, ohne die Spiellogik anzufassen.
  const STUFEN = [
    { kacheln: 3, spalten: 4, reihen: 3 },
    { kacheln: 4, spalten: 4, reihen: 3 },
    { kacheln: 5, spalten: 4, reihen: 4 },
    { kacheln: 6, spalten: 5, reihen: 4 },
    { kacheln: 7, spalten: 5, reihen: 4 },
    { kacheln: 8, spalten: 5, reihen: 5 },
    { kacheln: 9, spalten: 6, reihen: 5 },
    { kacheln: 10, spalten: 6, reihen: 5 },
    { kacheln: 11, spalten: 6, reihen: 6 },
    { kacheln: 12, spalten: 7, reihen: 6 },
  ];

  // So lange leuchtet das Muster. Gleich lang in jeder Runde: eine Zeit, die
  // mitschrumpft, machte aus dem Merkspiel ein Tempospiel.
  const ZEIGEN_MS = 2500;
  // Wie viele, sagt das Wagen-Set: fünf im ersten, neun im zweiten (kids.js).
  const RUNS_FOR_DONE = window.LernappKids?.wagonRounds?.() || 5;
  const TOP_COUNT = 5;

  // ---------------------------------------------------------------------------
  // Bestenliste – lokal und in der Cloud
  // ---------------------------------------------------------------------------
  const store = cloudApi
    ? cloudApi.register({ key: "lernapp.kacheln", empty: { runs: 0, scores: [] }, merge: cloudApi.mergeScores(TOP_COUNT) })
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
  // Muster würfeln
  // ---------------------------------------------------------------------------
  function stufeFuer(runde) {
    return STUFEN[Math.min(runde, STUFEN.length - 1)];
  }

  // Fisher-Yates über alle Felder, die ersten n nehmen: so kann kein Feld
  // zweimal im Muster stehen, und jedes ist gleich wahrscheinlich.
  function musterFuer(stufe) {
    const felder = [...Array(stufe.spalten * stufe.reihen).keys()];
    for (let i = felder.length - 1; i > 0; i -= 1) {
      const j = zufall.ganz(i + 1);
      [felder[i], felder[j]] = [felder[j], felder[i]];
    }
    return new Set(felder.slice(0, stufe.kacheln));
  }

  // ---------------------------------------------------------------------------
  // Zustand
  // ---------------------------------------------------------------------------
  const state = { phase: "merken", runde: 0, punkte: 0, muster: new Set(), offen: new Set() };
  let shell = null;
  let prompt = null;
  let raster = null;
  let felder = [];
  let stepTimer = null;
  // Die Gegner (geist.js): Platz 1 und die eigene Bestmarke als Zielmarke.
  let gegner = null;
  // Die Aufzeichnung der Züge (geist.js, zuege): Mit ihr lässt sich der Lauf
  // später aus der Hall of Fame anschauen.
  let aufnahme = null;
  // Wem zugeschaut wird: im Multiplayer nach dem eigenen Ende (live-spiel.js,
  // Zuschauen), oder ein Lauf aus der Hall of Fame (geist.js, zuschauer).
  let zuschauer = null;

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  // ---------------------------------------------------------------------------
  // Klänge
  // ---------------------------------------------------------------------------
  // Ein ganzes Muster ohne Fehler ist ein perfekter Zug: die Harfe. Alle
  // fünf Muster klingt statt dessen der Meilenstein. runden: wie viele Muster
  // jetzt ganz gefunden sind.
  function musterKlang(runden) {
    if (runden % 5 === 0) klang()?.ton?.("meilenstein");
    else klang()?.ton?.("perfekt");
  }

  // Daneben getippt: Die Kachel klingt wie jede, dazu der Fehler – ein
  // eigener Klang für das Ende fehlt diesem Spiel.
  function danebenKlang() {
    klang()?.ton?.("kacheln.tippen", { laut: 0.6 });
    klang()?.ton?.("fehler");
  }

  // ---------------------------------------------------------------------------
  // Das Raster
  // ---------------------------------------------------------------------------
  // Hochkant wird das Raster gekippt: aus 5 mal 4 werden 4 mal 5. Es sind
  // dieselben Kacheln in derselben Zahl, nur anders gelegt – und auf einem
  // hohen Bildschirm passen sie so doppelt so gross hinein. Das Muster ist
  // eine Auswahl von Feldern, keine Form; es bleibt, was es war.
  //
  // Entschieden wird das beim Bauen, nicht bei jeder Drehung: Ein Raster, das
  // sich mitten in der Runde umlegt, nähme dem Kind das, worauf es sich eben
  // etwas gemerkt hat.
  function gelegt(stufe) {
    const hoch = window.innerHeight > window.innerWidth;
    return hoch
      ? { spalten: Math.min(stufe.spalten, stufe.reihen), reihen: Math.max(stufe.spalten, stufe.reihen) }
      : { spalten: Math.max(stufe.spalten, stufe.reihen), reihen: Math.min(stufe.spalten, stufe.reihen) };
  }

  function buildRaster(stufe) {
    raster.innerHTML = "";
    const { spalten, reihen } = gelegt(stufe);
    raster.style.setProperty("--kk-spalten", spalten);
    raster.style.setProperty("--kk-reihen", reihen);
    raster.setAttribute("aria-label", `Raster mit ${spalten} mal ${reihen} Kacheln`);
    felder = [...Array(spalten * reihen).keys()].map((index) => {
      const kachel = shell.el("button", "kk-kachel");
      kachel.type = "button";
      const spalte = (index % spalten) + 1;
      const reihe = Math.floor(index / spalten) + 1;
      kachel.setAttribute("aria-label", `Reihe ${reihe}, Spalte ${spalte}`);
      kachel.addEventListener("click", () => tap(index, kachel));
      raster.append(kachel);
      return kachel;
    });
  }

  // ---------------------------------------------------------------------------
  // Ablauf
  // ---------------------------------------------------------------------------
  function startRun() {
    clearStep();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("play");
    state.runde = 0;
    state.punkte = 0;
    shell.setCount(0);
    // Hier gibt es kein Vorher: Die Runde beginnt mit dem ersten Muster.
    gegner?.runde();
    gegner?.los();
    aufnahme?.los();

    shell.clear();
    prompt = shell.el("p", "cm-prompt kk-prompt", "Merk dir die Kacheln.");
    raster = shell.el("div", "kk-raster");
    shell.play.append(prompt, raster);

    nextRound();
  }

  function nextRound() {
    const stufe = stufeFuer(state.runde);
    state.phase = "merken";
    state.muster = musterFuer(stufe);
    state.offen = new Set(state.muster);
    buildRaster(stufe);

    prompt.textContent = "Merk dir die Kacheln.";
    felder.forEach((kachel, index) => {
      kachel.disabled = true;
      if (state.muster.has(index)) kachel.classList.add("is-muster");
    });
    // Ein Ton, wenn das Muster aufleuchtet: Alle Kacheln leuchten zugleich.
    klang()?.ton?.("kacheln.leuchten");
    meldeZug(0);

    stepTimer = window.setTimeout(() => {
      // Muster weg, Raster frei: ab jetzt sind alle Kacheln wieder gleich.
      felder.forEach((kachel) => { kachel.classList.remove("is-muster"); kachel.disabled = false; });
      state.phase = "tippen";
      prompt.textContent = "Tippe die Kacheln an.";
      meldeZug(1);
    }, ZEIGEN_MS);
  }

  function tap(index, kachel) {
    if (state.phase !== "tippen") return;
    // Dieselbe Kachel ein zweites Mal: das ist kein Fehler, sondern ein Tipp
    // ins Leere – die Kachel liegt schon aufgedeckt da.
    if (!state.offen.has(index)) {
      if (state.muster.has(index)) return;
      kachel.disabled = true;
      kachel.classList.add("is-daneben");
      state.phase = "over";
      danebenKlang();
      felder.forEach((other) => { other.disabled = true; });
      // Kurz zeigen, welche es gewesen wären – sonst bleibt die Runde ohne
      // Antwort, und beim nächsten Mal weiss man wieder nichts.
      state.muster.forEach((feld) => felder[feld].classList.add("is-muster"));
      meldeZug(2, index);
      stepTimer = window.setTimeout(finish, 900);
      return;
    }

    state.offen.delete(index);
    state.punkte += 1;
    shell.setCount(state.punkte);
    gegner?.takt(state.punkte);
    kachel.disabled = true;
    kachel.classList.add("is-treffer");
    // Jeder Tipp, also nicht zu laut.
    klang()?.ton?.("kacheln.tippen", { laut: 0.7 });
    kids()?.vibrate?.(16);
    meldeZug(1);

    if (state.offen.size) return;
    state.phase = "merken";
    state.runde += 1;
    musterKlang(state.runde);
    prompt.textContent = "Alle gefunden!";
    stepTimer = window.setTimeout(nextRound, 620);
  }

  function runsText(runs) {
    const left = RUNS_FOR_DONE - runs;
    if (left <= 0) return "Dieses Spiel ist geschafft – der Wagen ist gebaut.";
    return left === 1
      ? "Noch eine Runde bis zum fertigen Wagen."
      : `Noch ${left} Runden bis zum fertigen Wagen.`;
  }

  function musterText(runden) {
    if (!runden) return "Noch kein Muster ganz gefunden.";
    return runden === 1 ? "Ein Muster ganz gefunden." : `${runden} Muster ganz gefunden.`;
  }

  // ---------------------------------------------------------------------------
  // Im Multiplayer: die eigenen Kacheln für die anderen, ihre für einen selbst
  // ---------------------------------------------------------------------------
  /*
   * Ein Zug (live-spiel.js, zug) – sofort, bei jedem Muster, jedem Wechsel
   * vom Merken zum Tippen und jedem Tipp, immer der ganze Stand:
   *
   *   c   Runde × 4 + was gerade ist: 0 das Muster leuchtet, 1 er tippt,
   *       2 daneben getippt
   *   a   welche Kacheln des Musters er schon gefunden hat, als Bits
   *   b   die Kachel daneben + 1 (sonst 0)
   *
   * Die Muster kommen aus derselben Saat. Wer zuschaut, würfelt sie in
   * derselben Reihe und zeigt, was zu dem Zug gehört, der gerade dran ist.
   */
  function meldeZug(was, daneben = -1) {
    if (zuschauer) return;
    let gefunden = 0;
    state.muster.forEach((feld) => { if (!state.offen.has(feld)) gefunden += 2 ** feld; });
    const ort = { a: gefunden, b: daneben + 1, c: state.runde * 4 + was };
    aufnahme?.zug(state.punkte, ort);
    const live = window.LernappLiveSpiel;
    if (shell?.live && live?.zug && live.gestartet?.()) live.zug(state.punkte, ort);
  }

  const zuschau = { muster: [], runde: -1, gezeigt: "", frame: 0, probe: null };

  // Wie viele Kacheln eines Musters gefunden sind (die Bits in a). Geteilt
  // statt geschoben: Ab 32 Feldern rechnet ein Shift in JavaScript falsch.
  function gefundenZahl(a) {
    let n = 0;
    for (let x = a; x > 0; x = Math.floor(x / 2)) n += x % 2;
    return n;
  }

  // Beim Zuschauen klingt, was beim anderen klang: das Muster, jeder Tipp,
  // das Ende. vorher: der Zug, der davor zu sehen war.
  function zugKlang(probe, vorher) {
    const runde = Math.floor(probe.c / 4);
    const was = probe.c - runde * 4;
    if (was === 0) {
      if (vorher?.c !== probe.c) klang()?.ton?.("kacheln.leuchten");
      return;
    }
    if (was === 2) { danebenKlang(); return; }
    const schon = vorher && Math.floor(vorher.c / 4) === runde ? gefundenZahl(vorher.a) : 0;
    const jetzt = gefundenZahl(probe.a);
    if (jetzt <= schon) return;
    klang()?.ton?.("kacheln.tippen", { laut: 0.7 });
    if (jetzt >= stufeFuer(runde).kacheln) musterKlang(runde + 1);
  }

  // Die Muster der Runden bis n – in derselben Reihe gewürfelt wie beim
  // anderen, sonst wären es andere.
  function musterDerRunde(n) {
    while (zuschau.muster.length <= n) zuschau.muster.push(musterFuer(stufeFuer(zuschau.muster.length)));
    return zuschau.muster[n];
  }

  function zeigeZug(probe) {
    const runde = Math.floor(probe.c / 4);
    const was = probe.c - runde * 4;
    const muster = musterDerRunde(runde);
    if (runde !== zuschau.runde) {
      buildRaster(stufeFuer(runde));
      zuschau.runde = runde;
    }
    let alle = true;
    felder.forEach((kachel, index) => {
      const drin = muster.has(index);
      const gefunden = drin && Math.floor(probe.a / 2 ** index) % 2 === 1;
      if (drin && !gefunden) alle = false;
      kachel.disabled = true;
      kachel.classList.toggle("is-muster", drin && was !== 1);
      kachel.classList.toggle("is-treffer", gefunden);
      kachel.classList.toggle("is-daneben", was === 2 && index === probe.b - 1);
    });
    prompt.textContent = was === 0 ? "Merk dir die Kacheln." : alle ? "Alle gefunden!" : "Tippe die Kacheln an.";
    state.punkte = probe.p;
    shell.setCount(probe.p);
  }

  function zuschauSchleife() {
    zuschau.frame = window.requestAnimationFrame(zuschauSchleife);
    // Ein Lauf aus der Hall of Fame: am Schluss die Tafel.
    zuschauer?.weiter?.();
    const probe = zuschauer?.letzte?.(zuschauer.jetzt());
    if (!probe) return;
    const schluessel = `${probe.c}|${probe.a}|${probe.b}|${probe.p}`;
    if (schluessel === zuschau.gezeigt) return;
    zuschau.gezeigt = schluessel;
    // Nur, was gerade geschieht: Wer mitten in einen Lauf einsteigt, hört
    // nicht alles Vergangene auf einmal.
    if (zuschauer.jetzt() - probe.t < 1500) zugKlang(probe, zuschau.probe);
    zuschau.probe = probe;
    zeigeZug(probe);
  }

  // Ab jetzt die Kacheln des anderen: dieselben Muster, und jeweils, wie weit
  // er damit ist.
  function zuschauenStarten() {
    if (!zuschauer?.letzte) return;
    clearStep();
    shell.closeOverlay();
    zufall.neu();
    shell.setPhase("play");
    state.phase = "zuschauen";
    zuschau.muster = [];
    zuschau.runde = -1;
    zuschau.gezeigt = "";
    zuschau.probe = null;
    shell.clear();
    prompt = shell.el("p", "cm-prompt kk-prompt", "");
    raster = shell.el("div", "kk-raster");
    shell.play.append(prompt, raster);
    zuschauer.los?.();
    if (!zuschau.frame) zuschau.frame = window.requestAnimationFrame(zuschauSchleife);
  }

  function finish() {
    if (zuschauer) return;
    clearStep();
    state.phase = "over";
    const punkte = state.punkte;
    const geist = aufnahme?.ende(gegner?.ende(punkte) || null) || null;
    const next = recordRun(punkte);
    shell.showResult({
      label: "Deine Kacheln",
      points: punkte,
      detail: musterText(state.runde),
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      geist,
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Kein Erklärbild und kein Startknopf: ein Tipp auf das Gebäude, und das
  // erste Muster leuchtet.
  shell = shellApi.mount({
    host,
    title: "Kacheln-Knobeln",
    area: "gedaechtnis",
    accent: "#7C5CE6",
    accentDark: "#5a41b8",
    clock: false,
    onRestart: () => (zuschauer ? zuschauenStarten() : startRun()),
    // Live-Modus: Die Runde beginnt zum gemeinsamen Start, nicht beim Laden.
    live: { los: startRun, stopp: () => finish(), zuschauen: (quelle) => { zuschauer = quelle; zuschauenStarten(); } },
  });
  zuschauer = window.LernappGeist?.zuschauer?.({
    host, spiel: "tileMemory", fassung: "z1", zufall, zuege: true, nochmal: zuschauenStarten,
  }) || null;
  if (!zuschauer) {
    gegner = window.LernappGeist?.fuer?.({ spiel: "tileMemory", host, art: "ziel" }) || null;
    aufnahme = window.LernappGeist?.zuege?.({ fassung: "z1", zufall }) || null;
  }

  // Wer einen Lauf anschaut, spielt keinen: Die Muster kommen mit dem Lauf.
  if (!shell.live && !zuschauer) startRun();
  zuschauer?.laden.then((da) => { if (da) zuschauenStarten(); });

  window.addEventListener("pagehide", () => {
    clearStep();
    if (zuschau.frame) window.cancelAnimationFrame(zuschau.frame);
    zuschau.frame = 0;
  });

  window.LernappKacheln = { STUFEN, ZEIGEN_MS, RUNS_FOR_DONE, stufeFuer, musterFuer, state };
})();
