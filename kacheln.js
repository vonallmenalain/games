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

  const HELP = [
    "Kacheln-Knobeln. Ein paar Kacheln leuchten kurz auf.",
    "Merk dir, welche es waren.",
    "Danach sehen alle Kacheln wieder gleich aus – tippe die leuchtenden nach.",
    "Hast du alle, kommt eine Kachel mehr dazu.",
    "Tippst du eine falsche an, ist die Runde vorbei.",
    "Beim Tippen hast du so viel Zeit, wie du willst.",
  ].join(" ");

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
      const j = Math.floor(Math.random() * (i + 1));
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

  function clearStep() {
    if (stepTimer) { window.clearTimeout(stepTimer); stepTimer = null; }
  }

  // ---------------------------------------------------------------------------
  // Das Raster
  // ---------------------------------------------------------------------------
  function buildRaster(stufe) {
    raster.innerHTML = "";
    raster.style.setProperty("--kk-spalten", stufe.spalten);
    raster.style.setProperty("--kk-reihen", stufe.reihen);
    raster.setAttribute("aria-label", `Raster mit ${stufe.spalten} mal ${stufe.reihen} Kacheln`);
    felder = [...Array(stufe.spalten * stufe.reihen).keys()].map((index) => {
      const kachel = shell.el("button", "kk-kachel");
      kachel.type = "button";
      const spalte = (index % stufe.spalten) + 1;
      const reihe = Math.floor(index / stufe.spalten) + 1;
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
    shell.setPhase("play");
    state.runde = 0;
    state.punkte = 0;
    shell.setCount(0);

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

    stepTimer = window.setTimeout(() => {
      // Muster weg, Raster frei: ab jetzt sind alle Kacheln wieder gleich.
      felder.forEach((kachel) => { kachel.classList.remove("is-muster"); kachel.disabled = false; });
      state.phase = "tippen";
      prompt.textContent = "Tippe die Kacheln an.";
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
      kids()?.playJingle?.("retry");
      felder.forEach((other) => { other.disabled = true; });
      // Kurz zeigen, welche es gewesen wären – sonst bleibt die Runde ohne
      // Antwort, und beim nächsten Mal weiss man wieder nichts.
      state.muster.forEach((feld) => felder[feld].classList.add("is-muster"));
      stepTimer = window.setTimeout(finish, 900);
      return;
    }

    state.offen.delete(index);
    state.punkte += 1;
    shell.setCount(state.punkte);
    kachel.disabled = true;
    kachel.classList.add("is-treffer");
    kids()?.playJingle?.("correct");
    kids()?.vibrate?.(16);

    if (state.offen.size) return;
    state.phase = "merken";
    state.runde += 1;
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

  function resultSpeech(punkte, runden, runs) {
    const kacheln = punkte === 1 ? "eine Kachel" : `${punkte} Kacheln`;
    const geschafft = runden === 0 ? "noch kein Muster"
      : runden === 1 ? "ein Muster" : `${runden} Muster`;
    return `Du hast ${kacheln} richtig getippt und ${geschafft} geschafft. ${runsText(runs)}`;
  }

  function finish() {
    clearStep();
    state.phase = "over";
    const punkte = state.punkte;
    const next = recordRun(punkte);
    kids()?.playJingle?.("win");
    shell.showResult({
      label: "Deine Kacheln",
      points: punkte,
      detail: musterText(state.runde),
      scores: next.scores,
      top: TOP_COUNT,
      note: { text: runsText(next.runs), done: next.runs >= RUNS_FOR_DONE },
      speech: resultSpeech(punkte, state.runde, next.runs),
    });
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  // Kein Erklärbild und kein Startknopf: ein Tipp auf das Gebäude, und das
  // erste Muster leuchtet. Was zu tun ist, sagt der Lautsprecher.
  shell = shellApi.mount({
    host,
    title: "Kacheln-Knobeln",
    area: "gedaechtnis",
    accent: "#7C5CE6",
    accentDark: "#5a41b8",
    help: HELP,
    clock: false,
    onRestart: startRun,
  });

  startRun();

  window.addEventListener("pagehide", clearStep);

  window.LernappKacheln = { STUFEN, ZEIGEN_MS, RUNS_FOR_DONE, stufeFuer, musterFuer };
})();
